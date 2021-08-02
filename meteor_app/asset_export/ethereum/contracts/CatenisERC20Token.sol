// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CatenisERC20Token is ERC20 {
    address private _owner;
    uint8 private _decimals;

    modifier restricted() {
        require(
            msg.sender == _owner,
            "This function is restricted to the contract's owner"
        );
        _;
    }

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _owner = msg.sender;
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public virtual restricted {
        _mint(to, amount);
    }

    function burn(uint256 amount) public virtual restricted {
        _burn(_owner, amount);
    }
}