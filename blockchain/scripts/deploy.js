const { ethers } = require("hardhat");

async function main() {
    const ShipmentTracking =
        await ethers.getContractFactory("ShipmentTracking");

    const shipmentTracking =
        await ShipmentTracking.deploy();

    await shipmentTracking.waitForDeployment();

    const address =
        await shipmentTracking.getAddress();

    console.log(
        "ShipmentTracking deployed to:",
        address
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
