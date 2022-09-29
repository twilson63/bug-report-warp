# Bug Report Demo

There is a bug in Warp 1.2 when using contracts that contain internalWrites, the result is state that does not have interactions applied over time. These interactions work well in Warp 1.1.x, so this repo is built to show two versions of the warp sdk and show the difference in output in hopes to showcase the problem. 

The home page will show the description of the report and two buttons, button 1 navigates to a page that demonstrates 1.1.x of the Warp SDK, and button 2 navigates to a page that demonstrates 1.2.x of Warp. The use case will be as follows on testnet:

* Generate 2 wallets (Wallet A, Wallet B)
* Add Tokens to each wallet
* Wallet A - creates a Tradeable Atomic Asset
* Wallet A - Lists the Tradeable Atomic Asset For Sale in BAR
* Wallet B - Purchases the Tradeable Atomic Asset using BAR
* Print out the State

## Setup

The setup step will need to deploy the following to testnet

- BAR Contract to Testnet
- Tradeable Atomic Asset Source

## Create Atomic Asset

We will create an atomic asset of the text `Hello World`

## Put 50% up for sale

In order to sale a tradeable asset we need to add the Bar contract as a pair.
Then create the sale order with a price.


## Buy 50% with BAR

To buy a tradeable asset we need to call allow on the bar contract to make sure the buyer has 
enough bar to purchase, then call create order on the asset contract to complete the transaction.



