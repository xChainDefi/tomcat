pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Skill.sol";


// 使用场景：
// 1: 将技能绑定到某机器人
// 2: 将技能从某机器人上解绑
// 3: 转移机器人给新的用户，同时自动转移绑定的技能
// 4: 将机器人上绑定的技能转给其它的机器人或用户
contract Robot is Ownable, ERC721 {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    using Address for address;
    using EnumerableSet for EnumerableSet.UintSet;

    struct RobotBase {
        string  name;             // 3~15字节长度
        // 1: 共6个等级，每升个等级会给予2个技能和3个装备，每个等级机器人数量不能超过上一个等级机器人数量的1/3，第一个等级数量可以无限制
        // 2: 每生成一个机器人，需要消耗对应等级的原石（ERC20），原石数量 = token.balanceOf(this).div(100).mul(level);
        uint256  level;            
        uint256  burnedECT;      // 消耗的原石数
        uint256 gender;             // 1: 男性，0: 女性(占10%)
        uint256 birthday;
        uint256 randomNum;       // (tokenCount * level * birthday)，预留今后使用
        uint256 lastBornTime;    // 最近一次生后代的时间，生后代的间隔需要大于等于七天
    }

    uint256 public tokenCount = 0;
    RobotBase[] public robotList;
    ERC20 public energyCellToken;    // 原石，是一种能源，需要通过抵押资产后挖矿产生
    mapping(uint256 => uint256) public levelRobotNumMap;   // 每个等级对应的机器人数量
    uint256 public maxLevel;
    uint256 public skillTimes;

    address payable public fundAddr;
    uint256 public lastWithdrawTime;

    uint256 public decimalFactor = 1e18;

    mapping(uint256 => EnumerableSet.UintSet) private robotSkillSet;
    Skill public skill;

    event BindSkill2Robot(uint256 indexed _robotTokenId, uint256 indexed _skillTokenId);
    event UnbindSkillFromRobot(uint256 indexed _robotTokenId, uint256 indexed _skillTokenId, address _to);
    event Mint(address indexed _to, string _name, uint256 _level);

    constructor(address _energyCellToken) ERC721("Robot", "RBT")  public {
        energyCellToken = ERC20(_energyCellToken);
        maxLevel = 8;
        skillTimes = 2;
        fundAddr = msg.sender;
    }

    function setMaxLevel(uint256 _maxLevel) public onlyOwner {
        maxLevel = _maxLevel;
    }

    function setSkillTimes(uint256 _skillTimes) public onlyOwner {
        skillTimes = _skillTimes;
    }

    function setSkill(address _skill) public onlyOwner {
        require(_skill.isContract());
        skill = Skill(_skill);
    }

    // 任何用户在满足条件下，都可以生成机器人
    function mint(address _to, string memory _name, uint256 _level) public returns (uint256) {
        require(_to != address(0));
        require(bytes(_name).length >= 3 && bytes(_name).length <= 32, "The length of name should be [3, 32].");
        require(_level >= 1 && _level <= maxLevel);
        if (_level > 1) {   // 此处用于控制每个等级机器人的数量
            uint256 leftNum = 0;
            (, leftNum) = getValidNumOfLevel(_level);
            require(leftNum > 0, "The number of robots is too much in this level.");
        }

        // 每生成一个机器人都需要消耗的原石，需要先approve
        uint256 burnedECT = evaluateECTBurned(_level);  // 需要消耗的原石数量 = 合约中原石量 / 100 * level of robot
        energyCellToken.safeTransferFrom(address(msg.sender), address(this), burnedECT);  // 将消耗的原石转移到合约地址

        // 生成机器人
        return generateRobot(_to, _name, _level, burnedECT);
    }

    function generateRobot(address _to, string memory _name, uint256 _level, uint256 _burnedECT) internal returns(uint256){
        tokenCount++;
        RobotBase memory robotBase = RobotBase({name: _name, level: _level, burnedECT: _burnedECT, 
                                                gender: tokenCount % 10 == 0 ? 0 : 1, 
                                                birthday: now, 
                                                randomNum: tokenCount.mul(_level).mul(now),
                                                lastBornTime: 0});
        robotList.push(robotBase);
        levelRobotNumMap[_level] += 1;
        _safeMint(_to, tokenCount);
        emit Mint(_to, _name, _level);
        return tokenCount;
    }

    // 机器人升级，条件：
    // 1: 当前等级的技能数已经无法增加
    // 2: 支付升级所需的原石，数量=新等级所需消耗的原石
    // 3: 上一级还有剩余空间容纳新机器人
    function upgrade(uint256 _robotTokenId) public {
        // 用户对机器人拥有操作权限
        require(isApprovedOrOwner(msg.sender, _robotTokenId));
        RobotBase storage robotBase = robotList[_robotTokenId - 1];
        uint256 curLevel = robotBase.level;
        uint256 curSkillNum = getRobotSkillNumber(_robotTokenId);

        uint256 curMaxSkillNum = getMaxSkillNumOfLevel(curLevel);
        require(curSkillNum == curMaxSkillNum, "Current number of skill is not enough.");

        uint256 leftRobotNum = 0;   // 上一级可新增的机器人总数
        (, leftRobotNum) = getValidNumOfLevel(curLevel + 1);
        require(leftRobotNum > 0, "There is no space to add new robot on next level.");

        uint256 burnedECT = evaluateECTBurned(curLevel + 1);  // 需要消耗的原石数量 = 合约中原石量 / 100 * level of robot
        energyCellToken.safeTransferFrom(address(msg.sender), address(this), burnedECT);  // 将消耗的原石转移到合约地址

        robotBase.level += 1;
        levelRobotNumMap[curLevel] -= 1;
        levelRobotNumMap[curLevel + 1] += 1;
    }

    function getRobot(uint256 _tokenId) view public returns(string memory _name, uint256 _level, uint256 _burnedECT, 
                                                            uint256 _gender, uint256 _birthday, uint256 _randomNum, uint256 _lastBornTime) {
        require(_tokenId > 0, "Token id must be bigger than zero.");
        RobotBase memory robotBase = robotList[_tokenId - 1];
        return (robotBase.name, robotBase.level, robotBase.burnedECT, 
                robotBase.gender, robotBase.birthday, robotBase.randomNum, robotBase.lastBornTime);
    }

    function setFundAddr(address payable _fundAddr) public onlyOwner {
        fundAddr = _fundAddr;
    }

    function born(uint256 _fatherRobotId, uint256 _motherRobotId, string memory _name) payable public {
        require(bytes(_name).length >= 3 && bytes(_name).length <= 32, "The lenght of name should be [3, 32].");
        require(msg.value >= 10 finney);
        // 用户对父、母机器人拥有操作权限
        require(ownerOf(_fatherRobotId) == msg.sender);
        require(ownerOf(_motherRobotId) == msg.sender);

        RobotBase storage fatherRobot = robotList[_fatherRobotId - 1];
        RobotBase storage motherRobot = robotList[_motherRobotId - 1];

        // 验证父母机器人性别，以及离上一次生育时间必须大于7天
        require(fatherRobot.gender == 1 && motherRobot.gender == 0);
        require(now - fatherRobot.lastBornTime > 7 days && now - motherRobot.lastBornTime > 7 days);

        // 计算机器人的level，level可能的最大值为父母的最大level+1
        uint256 base = fatherRobot.level.mul(fatherRobot.randomNum).mul(motherRobot.level).mul(motherRobot.randomNum).mul(now);
        uint256 childLevel = base % maxLevel + 1;
        uint256 parentMaxLevel = fatherRobot.level > motherRobot.level ? fatherRobot.level : motherRobot.level;
        if (parentMaxLevel < maxLevel && childLevel > parentMaxLevel + 1) {
            childLevel = parentMaxLevel + 1;
        }
        if (childLevel == 1) {
            generateRobot(msg.sender, _name, childLevel, 0);
        } else {
            uint256 leftRobotNum = 0;   // 可新增的机器人总数
            (, leftRobotNum) = getValidNumOfLevel(childLevel);
            while (leftRobotNum == 0) {
                childLevel -= 1;
                if (childLevel == 1) break;
                (, leftRobotNum) = getValidNumOfLevel(childLevel);
            }
            generateRobot(msg.sender, _name, childLevel, 0);
        }
        fatherRobot.lastBornTime = now;
        motherRobot.lastBornTime = now;
    }

    function getValidNumOfLevel(uint256 _level) view public returns(uint256 _maxNum, uint256 _leftNum) {
        require(_level > 1 && _level <= maxLevel);
        _maxNum = levelRobotNumMap[_level - 1].div(2);
        uint curNum = levelRobotNumMap[_level];
        _leftNum = _maxNum - curNum;
    }

    // maxSkillNum: 最多可携带技能数量
    function getMaxSkillNumOfLevel(uint256 _level) view public returns(uint256 _maxSkillNum) {
        return _level * skillTimes;
    }

    function evaluateECTBurned(uint256 _level) view public returns(uint256 _burnedECT) {
        uint8 decimals = energyCellToken.decimals();
        uint256 tokenOfRobotPool = energyCellToken.balanceOf(address(this));
        _burnedECT = tokenOfRobotPool.mul(1 << (_level - 1)).div(1000);  // 需要消耗的原石数量
        uint256 baseNum = (1 << (_level - 1)).mul(decimalFactor);
        if (_burnedECT < baseNum) {
            _burnedECT = baseNum;
        }
        return _burnedECT;
    }

    function bindSkill2Robot(uint256 _robotTokenId, uint256 _skillTokenId) public {
        // 用户对机器人拥有操作权限
        require(isApprovedOrOwner(msg.sender, _robotTokenId));
        require(getMaxSkillNumOfLevel(robotList[_robotTokenId - 1].level) > getRobotSkillNumber(_robotTokenId));
        // 将技能的owner修改为本合约，同时记录robot的编号，通过【合约+编号】便能确定技能属于哪个机器人
        // 注意：这一步想要执行成功，需要用户先将技能的操作权限授权给本合约
        skill.transferToParent(msg.sender, address(this), _robotTokenId, _skillTokenId);
        robotSkillSet[_robotTokenId].add(_skillTokenId);
        emit BindSkill2Robot(_robotTokenId, _skillTokenId);
    }

    function unbindSkillFromRobot(uint256 _robotTokenId, uint256 _skillTokenId, address _to) public {
        // 用户对机器人拥有操作权限，所以对技能也拥有权限
        require(isApprovedOrOwner(msg.sender, _robotTokenId));
        // 将技能的owner修改为本合约，同时记录robot的编号，通过【合约+编号】便能确定技能属于哪个机器人
        skill.transferFromParent(address(this), _robotTokenId, _to, _skillTokenId);
        robotSkillSet[_robotTokenId].remove(_skillTokenId);
        emit UnbindSkillFromRobot(_robotTokenId, _skillTokenId, _to);
    }

    function getRobotSkillNumber(uint256 _robotTokenId) view public returns(uint256) {
        require(_exists(_robotTokenId));
        return robotSkillSet[_robotTokenId].length();
    }

    function getRobotSkillId(uint256 _robotTokenId, uint256 _index) view public returns(uint256) {
        require(_exists(_robotTokenId));
        return robotSkillSet[_robotTokenId].at(_index);
    }

    function isApprovedOrOwner(address spender, uint256 tokenId) public view returns (bool) {
        return _isApprovedOrOwner(spender, tokenId);
    }

    function withdraw() public onlyOwner {
        fundAddr.transfer(address(this).balance);
    }
}