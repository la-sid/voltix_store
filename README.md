# Voltix Tech Store

A complete e-commerce website (Node.js, zero dependencies) with a Jenkins pipeline.

Features: 36 products, categories, search, sorting, product details, cart, checkout form,
stock tracking and saved orders.

## Files
- server.js      web server + API
- products.js    product catalogue (edit this to change products)
- index.html     the storefront
- store.test.js  automated tests
- Jenkinsfile    pipeline: Checkout, Check Node, Test, Deploy, Verify

## Run on your own computer
    node server.js
Open http://localhost:3001

## Run the tests
    npm test

## Jenkins
Needs Node.js installed on the Jenkins machine. Create a Multibranch Pipeline job that points to this repo.
After a green build the store is live at http://localhost:3001
