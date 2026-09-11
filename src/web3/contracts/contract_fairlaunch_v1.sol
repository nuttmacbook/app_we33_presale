// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Constant {
    uint256 constant VERSION = 1000;

    address constant ZERO = address(0);
    address constant DEAD = address(0xdead);
    uint256 constant MAX = type(uint256).max;

    IERC20 constant tether = IERC20(0x55d398326f99059fF775485246999027B3197955);
}

contract Storage is Constant {
    bool _initialized;
    address public _owner;

    string public name;
    string public symbol;
    uint8 public decimals;

    uint256 _totalSupply;
    
    mapping(address => uint256) _balances;
    mapping(address => mapping(address => uint256)) _allowances;

    mapping(address => bool) _isAdded;

    bool _isLive;
    uint256 _user;
}

contract FairLaunchToken is Storage {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == _owner, "Not owner");
        _;
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _owner,
        uint256 _initialSupply
    ) external {
        require(!_initialized, "Already initialized");

        _initialized = true;
        _owner = _owner;

        name = _name;
        symbol = _symbol;
        decimals = _decimals;

        _isLive = true;

        _mint(_owner, _initialSupply);
    }

    function version() public pure returns (uint256) {
        return VERSION;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address holder, address spender) external view returns (uint256) {
        return _allowances[holder][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ERC20: allowance exceeded");
        _approve(from, msg.sender, currentAllowance - amount);
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "ERC20: transfer to zero");
        uint256 bal = _balances[from];
        require(bal >= amount, "ERC20: balance too low");
        _balances[from] = bal - amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: mint to zero");
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _approve(address holder, address spender, uint256 amount) internal {
        require(spender != address(0), "ERC20: approve to zero");
        _allowances[holder][spender] = amount;
        emit Approval(holder, spender, amount);
    }

    function getFairLaunchInfo(address account) public view returns (
        uint256, uint256, uint256, uint256, uint256
    ) {
        return (
            _user,
            _totalSupply,
            _totalSupply * 10 / 11,
            tether.balanceOf(account),
            _balances[account]
        );
    }

    function mint(address to, address referrer, uint256 amount) external {
        require(to != referrer, "Wrong Referrer Address");
        require(_isLive, "Out Of Date");

        if (!_isAdded[to]) {
            _isAdded[to] = true;
            _user++;
        }

        tether.transferFrom(msg.sender, address(this), amount);

        uint256 amountToSplit = amount / 10;

        tether.transfer(0xd12D7Aa377D059CF77B33a7Eb8039dB7900337e6, amountToSplit);
        tether.transfer(0x2B7d1004D17174c6f633cd5A06F8F70F9ee741C4, amountToSplit);
        tether.transfer(_owner, amount - (amountToSplit * 2));

        _mint(to, amount);
        _mint(referrer, amount / 10);
    }

    function settingState(bool flag) public onlyOwner {
        _isLive = flag;
    }

    function transferETH(address to, uint256 amount) public onlyOwner {
        (bool success, ) = to.call{ value: amount }("");
        require(success);
    }

    function transferToken(address token, address to, uint256 amount) public onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}