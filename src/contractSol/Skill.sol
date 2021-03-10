pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SkillDividentToken.sol";

contract Skill is Ownable, ERC721 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct SkillBase {
        string name;
        string desc;
        string officialUrl;   // 官网URL

        // 技能等级，由发行方自行确定，等级越高，发行的时候需要消耗的原石也越多
        // 当技能被首次转让出去后，可将原石计入开发者共享的交易分红池中
        // 开发者可以根据不同等级，给予用户不同的技能体验
        uint256 level;

        uint256 createdTime;

        uint256 burnedECT;  // 消耗的原石数量
        bool hasRobot;
        uint256 robotId;
    }

    uint256 public tokenCount = 0;
    SkillBase[] public skillBaseList;
    IERC20 public energyCellToken;   // 原石token，是一种能源，需要通过抵押挖矿产生
    mapping(uint256 => uint256) public levelSkillNumMap;   // 每个等级对应的技能数量

    SkillDividentToken public skillDividentToken;  // 分红Token
    mapping(uint256 => bool) public dividentTokenRecordMap;   // 某项技能是否领取过分红（仅首次交易可领取分红）

    uint256 public maxLevel;

    event TransferToParent(address indexed _from, address indexed _toContract, uint256 indexed _parentTokenId, uint256 _childTokenId);
    event TransferFromParent(address indexed _fromContract, uint256 indexed _parentTokenId, address indexed _to, uint256 _childTokenId);
    event Mint(address indexed _to, string _name, uint256 _level);


    constructor (address _energyCellToken) ERC721("Robot's skill", "RST") public {
        energyCellToken = IERC20(_energyCellToken);
        skillDividentToken = new SkillDividentToken();
        maxLevel = 8;
    }

    function setMaxLevel(uint256 _maxLevel) public onlyOwner {
        maxLevel = _maxLevel;
    }

    // 任何用户在满足条件下，都可以生成自己的技能
    function mint(address _to, string memory _name, string memory _desc, string memory _tokenURI, string memory _officialUrl, uint256 _level) public returns (uint256) {
        require(_to != address(0));
        require(bytes(_name).length >= 3 && bytes(_name).length <= 15, "The lenght of name should be [3, 15].");
        require(bytes(_desc).length >= 3 && bytes(_desc).length <= 50, "The lenght of desc should be [3, 50].");

        require(_level >= 1 && _level <= maxLevel);
        if (_level > 1) {   // 此处用于控制每个等级技能的比例
            uint256 leftNum = 0;
            (, leftNum) = getValidNumOfLevel(_level);
            require(leftNum > 0, "There is no space left for create skill on this level.");
        }

        // 每生成一个技能需要消耗的原石
        uint256 burnedECT = evaluateECTBurned(_level);  // 需要消耗的原石数量 = 合约中原石量 / 100 * level of skill
        energyCellToken.safeTransferFrom(address(msg.sender), address(this), burnedECT);  // 将消耗的原石转移到本合约，此合约的原石不可提取，相当于销毁

        // 生成技能
        SkillBase memory skillBase = SkillBase({name: _name, desc: _desc, officialUrl: _officialUrl,
                                                level: _level, createdTime: now, burnedECT: burnedECT, hasRobot: false, robotId: 0});
        skillBaseList.push(skillBase);
        levelSkillNumMap[_level] += 1;
        tokenCount++;
        _safeMint(_to, tokenCount);
        _setTokenURI(tokenCount, _tokenURI);
        dividentTokenRecordMap[tokenCount] = false;  // 表示此技能尚未加入分红池，需要等到首次转让后才能加入
        emit Mint(_to, _name, _level);
        return tokenCount;
    }

    // function getSkill(uint256 _tokenId) 
    //     view public returns(string memory _name, string memory _desc, string memory _picUrl, 
    //                         string memory _officialUrl, uint256 _level, uint256 _createdTime, uint256 _burnedECT,
    //                         bool _hasRobot, uint256 _robotId) {
    //     require(_tokenId > 0 && _tokenId < skillBaseList.length, "Token id must be bigger than zero.");
    //     SkillBase memory skillBase = skillBaseList[_tokenId - 1];
    //     string memory baseURI = tokenURI(_tokenId);
    //     return (skillBase.name, skillBase.desc, baseURI, skillBase.officialUrl, 
    //             skillBase.level, skillBase.createdTime, skillBase.burnedECT, skillBase.hasRobot, skillBase.robotId);
    // }

    // 统计最近7天以内的消耗的原石总量
    function getTotalBurnedECTIn7Days() view public returns(uint256) {
        uint256 totalBurnedECT = 0;
        for (uint256 tokenId = tokenCount; tokenId > 0; tokenId--) {
            SkillBase memory skillBase = skillBaseList[tokenId - 1];
            if (now - skillBase.createdTime > 7 days) break;
            totalBurnedECT = totalBurnedECT.add(skillBase.burnedECT);
        }
        return totalBurnedECT;
    }

    function evaluateECTBurned(uint256 _level) view public returns(uint256) {
        uint256 totalBurnedECT = getTotalBurnedECTIn7Days();
        uint256 burnedECT = totalBurnedECT.mul(_level).div(100);  // 需要消耗的原石数量 = 合约中原石量 / 100 * level of skill
        return burnedECT;
    }

    function setTokenURI(uint256 _tokenId, string memory _tokenURI) public {
        require(_isApprovedOrOwner(msg.sender, _tokenId));
        _setTokenURI(_tokenId, _tokenURI);
    }

    function setBaseURI(string memory _baseURI) public onlyOwner {
        _setBaseURI(_baseURI);
    }

    function getValidNumOfLevel(uint256 _level) view public returns(uint256 _maxNum, uint256 _leftNum) {
        require(_level > 1 && _level <= maxLevel);
        _maxNum = levelSkillNumMap[_level - 1].div(2);
        uint curNum = levelSkillNumMap[_level];
        _leftNum = _maxNum - curNum;
    }

    // 当ERC721在进行转移时，会调用此函数
    // 如果NFT是首次交易，则将其消耗的原石数量作为抵押加入分红池
    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override { 
        if (from == address(0) || to == address(0)) return;
        SkillBase memory skillBase = skillBaseList[tokenId - 1];
            
        if (!dividentTokenRecordMap[tokenId - 1]) {  // mint
            skillDividentToken.mint(from, skillBase.burnedECT);
            dividentTokenRecordMap[tokenId - 1] = true;
        }
    }

    // 此接口如果是robot合约调用，则msg.sender是合约地址，因此robot合约需要满足isApprovedOrOwner()接口，需要先将skill授权给合约，
    // from：skill当前的owner
    function transferToParent(address _from, address _toContract, uint256 _parentTokenId, uint256 _childTokenId) public {
        transferFrom(_from, _toContract, _childTokenId);
        SkillBase storage skillBase = skillBaseList[_childTokenId - 1];
        skillBase.hasRobot = true;
        skillBase.robotId = _parentTokenId;
        emit TransferToParent(_from, _toContract, _parentTokenId, _childTokenId);
    }
    
    // 当用户直接调用此接口时，除非获得机器人合约授权，否则将失败，而合约内部无授权功能
    // 当技能归属于某个机器人时，只有机器人合约调用此接口才能成功
    function transferFromParent(address _fromContract, uint256 _parentTokenId, address _to, uint256 _childTokenId) public {
        SkillBase storage skillBase = skillBaseList[_childTokenId - 1];
        require(skillBase.hasRobot && skillBase.robotId == _parentTokenId);
        transferFrom(_fromContract, _to, _childTokenId);
        skillBase.hasRobot = false;
        skillBase.robotId = 0;
        emit TransferFromParent(_fromContract, _parentTokenId, _to, _childTokenId);
    }
}