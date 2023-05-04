# Bicycle registration on blockchain

We love cycling for the joy and convenience. But bicycle theft puts a huge damper on both.

All major bicycle components, notably the frame and the fork, have serial numbers assigned to them. Registering ownership information in a public database, such as a blockchain, would help to deter thieves and recover stolen property by reducing the anonymity of theft, fostering a safer cycling community. 

The appeal of a blockchain-focused registration system stems from its global applicability and potential ease of adoption. Accessible to manufacturers, retailers, consumers, and authorities worldwide, it is poised to remain relevant and effective for years to come. No dedicated infrastructure maintenance efforts or costs are needed for the basic functionality, as all interactions are recorded as transactions on the blockchain, for which existing tools such as blockchain explorers and wallets can be leveraged.

For our needs, a smart contract is code, usually written in Solidity, that outlines registration and ownership rules for bicycle components. Ethereum is the leading blockchain with smart contract capabilities and a large developer community. However, its transaction fees are unacceptably high compared to alternatives. The Polygon blockchain, for example, offers faster, more affordable transactions while maintaining security and Solidity compatibility.

Two main basic types of smart contracts have emerged. The first, ERC-20, is a standard for managing "fungible tokens." A "token" is a digital record of ownership, and "fungible" means they are interchangeable, like dollars. The second, ERC-721, is a standard for managing "non-fungible tokens" (NFTs), which are unique and cannot be directly exchanged at equal value. Essentially, an NFT is a digital record of ownership of a unique item, making it suitable for registering bicycle components.

Local bicycle shops are the ideal starting point for systematic bicycle component registration, as they connect cyclists, manufacturers, and authorities. By fostering security and responsibility, these shops can attract more customers, promote cycling, and ultimately boost their business.

A smart contract can be tailored to serve a local community, like a city, by addressing its specific needs. To expand the reach, another contract or website can consolidate missing bicycle data from multiple locations. This added decentralization minimizes the risk of failure due to mismanagement, ensuring a more effective, trustworthy, and reliable registration system.

Our proposal for the smart contract has the following main functionality:

 - Manufacturers or distributors can register a bicycle component (with optional contact information) as an NFT and assigning ownership (to themselves or to a customer). In the parlance of the blockchain this is called "minting" an NFT.
 - When the bicycle component changes hands legitimately, the NFT can be transferred to the new owner.
 - If a bicycle is stolen, the owner or an authorized party can mark the associated NFT on the blockchain as missing.
 - A bicycle shop, buyer or police can check if a suspicious bicycle component has been marked as missing. 

The potential uses of NFTs in a bicycle registration system extend beyond combating theft. For instance, NFTs could facilitate bicycle rentals or bicycle sharing, with smart contracts managing rental terms and payments. Auctions for bicycles could also be conducted through NFTs. Additionally, NFTs can enable the collection of valuable statistics on sales and theft patterns, which can inform data-driven strategies to enhance security. Other potential applications include tracking warranty claims, maintenance records, a marketplace for custom-built bicycles, collective insurance, crowd-sourced rewards for stolen bicycles, usage as collateral, reputation tracking, event organization, and club memberships.
