pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./IWETH.sol";
import "./StakingMiningPool.sol";

/// @title Auction Core
/// @dev Contains models, variables, and internal methods for the auction.
/// @notice We omit a fallback function to prevent accidental sends to this contract.
contract ClockAuctionBase is Ownable {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.UintSet;
    // Represents an auction on an NFT
    struct Auction {
        // Current owner of NFT
        address payable seller;
        // Price (in wei) at beginning of auction
        uint128 startingPrice;
        // Price (in wei) at end of auction
        uint128 endingPrice;
        // Duration (in seconds) of auction
        uint64 duration;
        // Time when auction started
        // NOTE: 0 if this auction has been concluded
        uint64 startedAt;
    }

    address public WETH = address(0); // address(0xACD351313c824cFBa070C405693aE8fe495395F8); //
    StakingMiningPool public stakingMiningPool;
    uint256 public dividentScale = 50;

    uint256 public totalAllocPoint;
    mapping(uint256 => uint256) pairAllocPointMap;  // pairIndex => point
    uint256[] public pairIndexList;

    // Reference to contract tracking NFT ownership
    ERC721 public nonFungibleContract;
    mapping(address => EnumerableSet.UintSet) private sellerNFTSet;

    // Cut owner takes on each auction, measured in basis points (1/100 of a percent).
    // Values 0-10,000 map to 0%-100%
    uint256 public ownerCut;

    // Map from token ID to their corresponding auction.
    mapping (uint256 => Auction) tokenIdToAuction;

    uint256 public totalAmount;

    event AuctionCreated(uint256 tokenId, uint256 startingPrice, uint256 endingPrice, uint256 duration);
    event AuctionSuccessful(uint256 tokenId, uint256 totalPrice, address winner);
    event AuctionCancelled(uint256 tokenId);

    constructor (address _nftAddress, uint256 _cut, address _stakingMiningPool, address _weth) public {
        require(_nftAddress != address(0) && _stakingMiningPool != address(0));
        require(_cut >= 0 && _cut <= 10000, "Cut should be between [0, 10000].");

        stakingMiningPool = StakingMiningPool(_stakingMiningPool);
        ownerCut = _cut;
        WETH = _weth;
        //require(candidateContract.supportsInterface(InterfaceSignature_ERC721));
        nonFungibleContract = ERC721(_nftAddress);
    }

    // pairIndex: stakingMiningPool里的子矿池编号
    // points: 子矿池在此NFT交易过程中能分到的分红比例
    function setDividentObject(uint256 pairIndex, uint256 points) public onlyOwner {
        require(points > 0, "Point of pair can't be zero.");
        if (points == 0) {
            totalAllocPoint = totalAllocPoint.sub(pairAllocPointMap[pairIndex]);
            delete pairAllocPointMap[pairIndex];
            return;
        }
        if (pairAllocPointMap[pairIndex] != 0) {
            totalAllocPoint = totalAllocPoint.sub(pairAllocPointMap[pairIndex]).add(points);
            pairAllocPointMap[pairIndex] = points;
        } else {
            pairIndexList.push(pairIndex);
            totalAllocPoint = totalAllocPoint.add(points);
            pairAllocPointMap[pairIndex] = points;
        }
    }
    // 设置分红系数，实际占手续费的比例为_dividentScale/100
    function setDividentScale(uint256 _dividentScale) public onlyOwner {
        dividentScale = _dividentScale;
    }

    function setStakingMiningPool(address _stakingMiningPool) public {
        stakingMiningPool = StakingMiningPool(_stakingMiningPool);
        totalAllocPoint = 0;
        for (uint256 i = 0; i < pairIndexList.length; i++) {
            delete pairAllocPointMap[pairIndexList[i]];
        }
        delete pairIndexList;
    }

    /// @dev Returns true if the claimant owns the token.
    /// @param _claimant - Address claiming to own the token.
    /// @param _tokenId - ID of token whose ownership to verify.
    function _owns(address _claimant, uint256 _tokenId) internal view returns (bool) {
        return (nonFungibleContract.ownerOf(_tokenId) == _claimant);
    }

    /// @dev Escrows the NFT, assigning ownership to this contract.
    /// Throws if the escrow fails.
    /// @param _owner - Current owner address of token to escrow.
    /// @param _tokenId - ID of token whose approval to verify.
    function _escrow(address _owner, uint256 _tokenId) internal {
        // it will throw if transfer fails
        nonFungibleContract.transferFrom(_owner, address(this), _tokenId);
    }

    /// @dev Transfers an NFT owned by this contract to another address.
    /// Returns true if the transfer succeeds.
    /// @param _receiver - Address to transfer NFT to.
    /// @param _tokenId - ID of token to transfer.
    function _transfer(address _receiver, uint256 _tokenId) internal {
        // it will throw if transfer fails
        nonFungibleContract.transferFrom(address(this), _receiver, _tokenId);
    }

    /// @dev Adds an auction to the list of open auctions. Also fires the
    ///  AuctionCreated event.
    /// @param _tokenId The ID of the token to be put on auction.
    /// @param _auction Auction to add.
    function _addAuction(uint256 _tokenId, Auction memory _auction) internal {
        // Require that all auctions have a duration of
        // at least one minute. (Keeps our math from getting hairy!)
        require(_auction.duration >= 1 minutes);

        tokenIdToAuction[_tokenId] = _auction;

        sellerNFTSet[_auction.seller].add(_tokenId);

        AuctionCreated(
            uint256(_tokenId),
            uint256(_auction.startingPrice),
            uint256(_auction.endingPrice),
            uint256(_auction.duration)
        );
    }

    /// @dev Cancels an auction unconditionally.
    function _cancelAuction(uint256 _tokenId, address _seller) internal {
        _removeAuction(_tokenId, _seller);
        _transfer(_seller, _tokenId);
        AuctionCancelled(_tokenId);
    }

    /// @dev Computes the price and transfers winnings.
    /// Does NOT transfer ownership of token.
    function _bid(uint256 _tokenId, uint256 _bidAmount)
        internal
        returns (uint256)
    {
        // Get a reference to the auction struct
        Auction storage auction = tokenIdToAuction[_tokenId];

        // Explicitly check that this auction is currently live.
        // (Because of how Ethereum mappings work, we can't just count
        // on the lookup above failing. An invalid _tokenId will just
        // return an auction object that is all zeros.)
        require(_isOnAuction(auction), "Not on auction.");

        // Check that the bid is greater than or equal to the current price
        uint256 price = _currentPrice(auction);
        require(_bidAmount >= price, "Bid amount should be larger than current price of token.");

        // Grab a reference to the seller before the auction struct
        // gets deleted.
        address payable seller = auction.seller;

        // The bid is good! Remove the auction before sending the fees
        // to the sender so we can't have a reentrancy attack.
        _removeAuction(_tokenId, seller);

        // Transfer proceeds to seller (if there are any!)
        if (price > 0) {
            // Calculate the auctioneer's cut.
            // (NOTE: _computeCut() is guaranteed to return a
            // value <= price, so this subtraction can't go negative.)
            uint256 auctioneerCut = _computeCut(price);
            uint256 sellerProceeds = price - auctioneerCut;

            // NOTE: Doing a transfer() in the middle of a complex
            // method like this is generally discouraged because of
            // reentrancy attacks and DoS attacks if the seller is
            // a contract with an invalid fallback function. We explicitly
            // guard against reentrancy attacks by removing the auction
            // before calling transfer(), and the only thing the seller
            // can DoS is the sale of their own asset! (And if it's an
            // accident, they can call cancelAuction(). )
            seller.transfer(sellerProceeds);

            if (pairIndexList.length > 0 && totalAllocPoint > 0) {
                uint256 dividentEth = auctioneerCut.mul(dividentScale).div(100);
                IWETH(WETH).deposit{value: dividentEth}();  // 将ETH兑换成WETH, 存放在本合约中
                for (uint256 i = 0; i < pairIndexList.length; i++) {
                    uint256 pairIndex = pairIndexList[i];
                    uint256 points = pairAllocPointMap[pairIndex];
                    if (points > 0) {
                        uint256 amount = dividentEth.mul(points).div(totalAllocPoint);
                        IWETH(WETH).approve(address(stakingMiningPool), amount);
                        stakingMiningPool.supplyMinedToken(pairIndex, amount);
                    }
                }     
            }       
        }

        // Calculate any excess funds included with the bid. If the excess
        // is anything worth worrying about, transfer it back to bidder.
        // NOTE: We checked above that the bid amount is greater than or
        // equal to the price so this cannot underflow.
        uint256 bidExcess = _bidAmount - price;

        // Return the funds. Similar to the previous transfer, this is
        // not susceptible to a re-entry attack because the auction is
        // removed before any transfers occur.
        msg.sender.transfer(bidExcess);

        totalAmount = totalAmount.add(price);

        // Tell the world!
        AuctionSuccessful(_tokenId, price, msg.sender);

        return price;
    }

    /// @dev Removes an auction from the list of open auctions.
    /// @param _tokenId - ID of NFT on auction.
    function _removeAuction(uint256 _tokenId, address _seller) internal {
        sellerNFTSet[_seller].remove(_tokenId);
        delete tokenIdToAuction[_tokenId];
    }

    function getTokenNumber(address _seller) view public returns(uint256) {
        return sellerNFTSet[_seller].length();
    }

    function getTokenId(address _seller, uint256 _index) view public returns(uint256) {
        return sellerNFTSet[_seller].at(_index);
    }

    /// @dev Returns true if the NFT is on auction.
    /// @param _auction - Auction to check.
    function _isOnAuction(Auction storage _auction) internal view returns (bool) {
        return (_auction.startedAt > 0);
    }

    /// @dev Returns current price of an NFT on auction. Broken into two
    ///  functions (this one, that computes the duration from the auction
    ///  structure, and the other that does the price computation) so we
    ///  can easily test that the price computation works correctly.
    function _currentPrice(Auction storage _auction)
        internal
        view
        returns (uint256)
    {
        uint256 secondsPassed = 0;

        // A bit of insurance against negative values (or wraparound).
        // Probably not necessary (since Ethereum guarnatees that the
        // now variable doesn't ever go backwards).
        if (now > _auction.startedAt) {
            secondsPassed = now - _auction.startedAt;
        }

        return _computeCurrentPrice(
            _auction.startingPrice,
            _auction.endingPrice,
            _auction.duration,
            secondsPassed
        );
    }

    /// @dev Computes the current price of an auction. Factored out
    ///  from _currentPrice so we can run extensive unit tests.
    ///  When testing, make this function public and turn on
    ///  `Current price computation` test suite.
    function _computeCurrentPrice(
        uint256 _startingPrice,
        uint256 _endingPrice,
        uint256 _duration,
        uint256 _secondsPassed
    )
        internal
        pure
        returns (uint256)
    {
        // NOTE: We don't use SafeMath (or similar) in this function because
        //  all of our public functions carefully cap the maximum values for
        //  time (at 64-bits) and currency (at 128-bits). _duration is
        //  also known to be non-zero (see the require() statement in
        //  _addAuction())
        if (_secondsPassed >= _duration) {
            // We've reached the end of the dynamic pricing portion
            // of the auction, just return the end price.
            return _endingPrice;
        } else {
            // Starting price can be higher than ending price (and often is!), so
            // this delta can be negative.
            int256 totalPriceChange = int256(_endingPrice) - int256(_startingPrice);

            // This multiplication can't overflow, _secondsPassed will easily fit within
            // 64-bits, and totalPriceChange will easily fit within 128-bits, their product
            // will always fit within 256-bits.
            int256 currentPriceChange = totalPriceChange * int256(_secondsPassed) / int256(_duration);

            // currentPriceChange can be negative, but if so, will have a magnitude
            // less that _startingPrice. Thus, this result will always end up positive.
            int256 currentPrice = int256(_startingPrice) + currentPriceChange;

            return uint256(currentPrice);
        }
    }

    /// @dev Computes owner's cut of a sale.
    /// @param _price - Sale price of NFT.
    function _computeCut(uint256 _price) internal view returns (uint256) {
        // NOTE: We don't use SafeMath (or similar) in this function because
        //  all of our entry functions carefully cap the maximum values for
        //  currency (at 128-bits), and ownerCut <= 10000 (see the require()
        //  statement in the ClockAuction constructor). The result of this
        //  function is always guaranteed to be <= _price.
        return _price * ownerCut / 10000;
    }

}



/// @title Clock auction for non-fungible tokens.
/// @notice We omit a fallback function to prevent accidental sends to this contract.
contract ClockAuction is Pausable, ClockAuctionBase {

    /// @dev The ERC-165 interface signature for ERC-721.
    ///  Ref: https://github.com/ethereum/EIPs/issues/165
    ///  Ref: https://github.com/ethereum/EIPs/issues/721
    bytes4 constant InterfaceSignature_ERC721 = bytes4(0x9a20483d);

    /// @dev Constructor creates a reference to the NFT ownership contract
    ///  and verifies the owner cut is in the valid range.
    /// @param _nftAddress - address of a deployed contract implementing
    ///  the Nonfungible Interface.
    /// @param _cut - percent cut the owner takes on each auction, must be
    ///  between 0-10,000.
    constructor(address _nftAddress, uint256 _cut, address _stakingMiningPool, address _weth) 
        ClockAuctionBase(_nftAddress, _cut, _stakingMiningPool, _weth) public {
    }

    /// @dev Remove all Ether from the contract, which is the owner's cuts
    ///  as well as any Ether sent directly to the contract address.
    ///  Always transfers to the NFT contract, but can be called either by
    ///  the owner or the NFT contract.
    function withdrawBalance() external onlyOwner {
        // We are using this boolean method to make sure that even if one fails it will still work
        msg.sender.transfer(address(this).balance);
    }

    /// @dev Creates and begins a new auction.
    /// @param _tokenId - ID of token to auction, sender must be owner.
    /// @param _startingPrice - Price of item (in wei) at beginning of auction.
    /// @param _endingPrice - Price of item (in wei) at end of auction.
    /// @param _duration - Length of time to move between starting
    ///  price and ending price (in seconds).
    /// @param _seller - Seller, if not the message sender
    function createAuction(
        uint256 _tokenId,
        uint256 _startingPrice,
        uint256 _endingPrice,
        uint256 _duration,
        address payable _seller
    )
        external
        whenNotPaused
    {
        // Sanity check that no inputs overflow how many bits we've allocated
        // to store them in the auction struct.
        require(_startingPrice == uint256(uint128(_startingPrice)));
        require(_endingPrice == uint256(uint128(_endingPrice)));
        require(_duration == uint256(uint64(_duration)));

        require(_owns(msg.sender, _tokenId));
        _escrow(msg.sender, _tokenId);  //  将NFT转移给竞拍合约
        Auction memory auction = Auction(
            _seller,
            uint128(_startingPrice),
            uint128(_endingPrice),
            uint64(_duration),
            uint64(now)
        );
        _addAuction(_tokenId, auction);
    }

    /// @dev Bids on an open auction, completing the auction and transferring
    ///  ownership of the NFT if enough Ether is supplied.
    /// @param _tokenId - ID of token to bid on.
    function bid(uint256 _tokenId)
        external
        payable
        whenNotPaused
    {
        // _bid will throw if the bid or funds transfer fails
        _bid(_tokenId, msg.value);
        _transfer(msg.sender, _tokenId);
    }

    /// @dev Cancels an auction that hasn't been won yet.
    ///  Returns the NFT to original owner.
    /// @notice This is a state-modifying function that can
    ///  be called while the contract is paused.
    /// @param _tokenId - ID of token on auction
    function cancelAuction(uint256 _tokenId)
        external
    {
        Auction storage auction = tokenIdToAuction[_tokenId];
        require(_isOnAuction(auction));
        address seller = auction.seller;
        require(msg.sender == seller);
        _cancelAuction(_tokenId, seller);
    }

    /// @dev Cancels an auction when the contract is paused.
    ///  Only the owner may do this, and NFTs are returned to
    ///  the seller. This should only be used in emergencies.
    /// @param _tokenId - ID of the NFT on auction to cancel.
    function cancelAuctionWhenPaused(uint256 _tokenId)
        whenPaused
        onlyOwner
        external
    {
        Auction storage auction = tokenIdToAuction[_tokenId];
        require(_isOnAuction(auction));
        _cancelAuction(_tokenId, auction.seller);
    }

    /// @dev Returns auction info for an NFT on auction.
    /// @param _tokenId - ID of NFT on auction.
    function getAuction(uint256 _tokenId)
        external
        view
        returns
    (
        address seller,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration,
        uint256 startedAt
    ) {
        Auction storage auction = tokenIdToAuction[_tokenId];
        require(_isOnAuction(auction));
        return (
            auction.seller,
            auction.startingPrice,
            auction.endingPrice,
            auction.duration,
            auction.startedAt
        );
    }

    /// @dev Returns the current price of an auction.
    /// @param _tokenId - ID of the token price we are checking.
    function getCurrentPrice(uint256 _tokenId)
        external
        view
        returns (uint256)
    {
        Auction storage auction = tokenIdToAuction[_tokenId];
        require(_isOnAuction(auction));
        return _currentPrice(auction);
    }

}

contract ClockAuctionFactory is Ownable {
    ClockAuction[] public clockAuctionList;
    mapping(address => uint256) public nftToAuctionIndexMap;

    function createClockAuction(address _nftAddress, uint256 _cut, address _stakingMiningPool, address _weth) public onlyOwner returns (uint256)  {
        require(_nftAddress != address(0) && _stakingMiningPool != address(0));
        require(_cut >= 0 && _cut <= 10000, "Cut should be between [0, 10000].");
        uint256 index = nftToAuctionIndexMap[_nftAddress];
        require(clockAuctionList.length == 0 || (index == 0 && clockAuctionList[0].nonFungibleContract.address != _nftAddress), "The auction of this nft has been created.");
        
        ClockAuction clockAuction = new ClockAuction(_nftAddress, _cut, _stakingMiningPool, _weth);
        clockAuction.transferOwnership(msg.sender);
        clockAuctionList.push(clockAuction);
        nftToAuctionIndexMap[_nftAddress] = clockAuctionList.length - 1;
        return clockAuctionList.length - 1;
    }
}