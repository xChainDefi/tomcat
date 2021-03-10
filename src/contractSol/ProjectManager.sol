pragma solidity ^0.6.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./EnergyCellToken.sol";
import "./ECTMasterChef.sol";
import "./ClockAuction.sol";
import "./Robot.sol";
import "./Skill.sol";
import "./SkillDividentToken.sol";
import "./StakingMiningPool.sol";


contract ProjectManager is Ownable {
    // address public WETH = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c);//address(0xACD351313c824cFBa070C405693aE8fe495395F8); //
    // EnergyCellToken public ectToken;
    // RobotMasterChef public robotMasterChef;
    // ClockAuctionFactory public clockAuctionFactory;
    // SkillDividentToken public skillDividentToken;
    // StakingMiningPool public stakingMiningPool;
    // Robot public robot;
    // Skill public skill;
    
    // constructor () public {
    //     ectToken =  new EnergyCellToken();   
    // }

    // function changeContractOwner(address newOwner) public onlyOwner {
    //     robotMasterChef.transferOwnership(newOwner);
    //     stakingMiningPool.transferOwnership(newOwner);
    //     clockAuctionFactory.transferOwnership(newOwner);
    // }

    // function createRobotAndSkill_0() public onlyOwner {
    //     robot = new Robot(address(ectToken));
    //     skill = new Skill(address(ectToken));
    //     skillDividentToken = skill.skillDividentToken();  // 技能分红合约是skill合约内部创建的
    // }

    // function createRobotMasterChef_1() public onlyOwner {
    //     // 矿池合约: 通过抵押价值币来挖原石token
    //     robotMasterChef = new RobotMasterChef(ectToken, address(robot), 10, block.number + 1000, block.number + 10000);
    //     // 将原石的owner权限转移给矿池合约，矿池合约才能mint原石token
    //     ectToken.transferOwnership(address(robotMasterChef));
    //     // 添加第一个抵押挖矿池
    //     robotMasterChef.addPool(100, IERC20(WETH), false);
    // }

    // function createStakingMiningPool_2() public onlyOwner {
    //     // 搭建抵押挖矿矿池，可以建立任意抵押token以及产出token的子矿池，其中产出token也需要用户自行投入到矿池中
    //     stakingMiningPool = new StakingMiningPool();
    //     stakingMiningPool.addPool(IERC20(skillDividentToken), IERC20(WETH), address(0), false);
    // }

    // function createClockAuction_3() public onlyOwner {
    //     // NFT交易池
    //     clockAuctionFactory = new ClockAuctionFactory();
    //     clockAuctionFactory.createClockAuction(address(robot), 100, address(stakingMiningPool));
    //     uint256 skillIndex = clockAuctionFactory.createClockAuction(address(skill), 100, address(stakingMiningPool)); 
    //     ClockAuction clockAuction = clockAuctionFactory.clockAuctionList(skillIndex);
    //     clockAuction.setDividentObject(0, 100);  // 为skill配置分红，将交易中的获利投入到第1个分红池
    // }
}