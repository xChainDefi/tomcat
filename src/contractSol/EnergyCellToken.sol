pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EnergyCellToken is ERC20, Ownable {
    constructor() ERC20("Energy cell token", "ECT") public {

    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }
}
