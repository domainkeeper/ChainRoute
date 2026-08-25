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

    // Grant roles to backend wallet for custodial wallet MVP
    const backendWalletAddress = process.env.BACKEND_WALLET_ADDRESS;
    if (backendWalletAddress) {
        const checksumAddress = ethers.getAddress(backendWalletAddress);

        console.log("Granting roles to backend wallet:", checksumAddress);

        const ADMIN_ROLE = await shipmentTracking.ADMIN_ROLE();
        await shipmentTracking.grantAdminRole(checksumAddress);
        console.log("  Granted ADMIN_ROLE");

        const TRANSPORTER_ROLE = await shipmentTracking.TRANSPORTER_ROLE();
        await shipmentTracking.grantTransporterRole(checksumAddress);
        console.log("  Granted TRANSPORTER_ROLE");

        const WAREHOUSE_ROLE = await shipmentTracking.WAREHOUSE_ROLE();
        await shipmentTracking.grantWarehouseRole(checksumAddress);
        console.log("  Granted WAREHOUSE_ROLE");

        const DISTRIBUTOR_ROLE = await shipmentTracking.DISTRIBUTOR_ROLE();
        await shipmentTracking.grantDistributorRole(checksumAddress);
        console.log("  Granted DISTRIBUTOR_ROLE");

        const RECEIVER_ROLE = await shipmentTracking.RECEIVER_ROLE();
        await shipmentTracking.grantReceiverRole(checksumAddress);
        console.log("  Granted RECEIVER_ROLE");

        console.log("All roles granted successfully.");
    } else {
        console.log("No BACKEND_WALLET_ADDRESS set. Skipping role grants.");
        console.log("Set BACKEND_WALLET_ADDRESS env var and re-run to grant roles.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
