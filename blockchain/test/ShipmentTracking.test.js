const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ShipmentTracking", function () {
  let contract;
  let owner, admin, transporter, warehouse, distributor, receiver, other;

  const SHIPMENT_ID = 12345;
  const SHIPMENT_ID_2 = 67890;

  beforeEach(async function () {
    [owner, admin, transporter, warehouse, distributor, receiver, other] = await ethers.getSigners();

    const ShipmentTracking = await ethers.getContractFactory("ShipmentTracking");
    contract = await ShipmentTracking.deploy();

    await contract.grantAdminRole(admin.address);
    await contract.grantTransporterRole(transporter.address);
    await contract.grantWarehouseRole(warehouse.address);
    await contract.grantDistributorRole(distributor.address);
    await contract.grantReceiverRole(receiver.address);
  });

  describe("Deployment", function () {
    it("should deploy with owner having DEFAULT_ADMIN_ROLE and ADMIN_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      const ADMIN_ROLE = await contract.ADMIN_ROLE();

      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await contract.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should have correct role constants", async function () {
      const ADMIN_ROLE = await contract.ADMIN_ROLE();
      const TRANSPORTER_ROLE = await contract.TRANSPORTER_ROLE();
      const WAREHOUSE_ROLE = await contract.WAREHOUSE_ROLE();
      const DISTRIBUTOR_ROLE = await contract.DISTRIBUTOR_ROLE();
      const RECEIVER_ROLE = await contract.RECEIVER_ROLE();

      expect(ADMIN_ROLE).to.equal(ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE")));
      expect(TRANSPORTER_ROLE).to.equal(ethers.keccak256(ethers.toUtf8Bytes("TRANSPORTER_ROLE")));
      expect(WAREHOUSE_ROLE).to.equal(ethers.keccak256(ethers.toUtf8Bytes("WAREHOUSE_ROLE")));
      expect(DISTRIBUTOR_ROLE).to.equal(ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE")));
      expect(RECEIVER_ROLE).to.equal(ethers.keccak256(ethers.toUtf8Bytes("RECEIVER_ROLE")));
    });
  });

  describe("Role Management", function () {
    it("should grant roles via grant functions", async function () {
      const ADMIN_ROLE = await contract.ADMIN_ROLE();
      expect(await contract.hasRole(ADMIN_ROLE, admin.address)).to.be.true;

      const TRANSPORTER_ROLE = await contract.TRANSPORTER_ROLE();
      expect(await contract.hasRole(TRANSPORTER_ROLE, transporter.address)).to.be.true;

      const WAREHOUSE_ROLE = await contract.WAREHOUSE_ROLE();
      expect(await contract.hasRole(WAREHOUSE_ROLE, warehouse.address)).to.be.true;

      const DISTRIBUTOR_ROLE = await contract.DISTRIBUTOR_ROLE();
      expect(await contract.hasRole(DISTRIBUTOR_ROLE, distributor.address)).to.be.true;

      const RECEIVER_ROLE = await contract.RECEIVER_ROLE();
      expect(await contract.hasRole(RECEIVER_ROLE, receiver.address)).to.be.true;
    });

    it("should reject role grants from non-admin", async function () {
      await expect(
        contract.connect(other).grantAdminRole(other.address)
      ).to.be.reverted;
    });
  });

  describe("createShipment", function () {
    it("should create a shipment as admin", async function () {
      const tx = contract.connect(admin).createShipment(SHIPMENT_ID);
      await expect(tx).to.emit(contract, "ShipmentCreated");

      const shipment = await contract.shipments(SHIPMENT_ID);
      expect(shipment.exists).to.be.true;
      expect(shipment.creator).to.equal(admin.address);
      expect(shipment.currentTransporter).to.equal(ethers.ZeroAddress);
      expect(shipment.currentCustodian).to.equal(ethers.ZeroAddress);
      expect(shipment.status).to.equal(0); // Created
    });

    it("should reject shipment creation from non-admin", async function () {
      await expect(
        contract.connect(transporter).createShipment(SHIPMENT_ID)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("should reject duplicate shipment creation", async function () {
      await contract.connect(admin).createShipment(SHIPMENT_ID);
      await expect(
        contract.connect(admin).createShipment(SHIPMENT_ID)
      ).to.be.revertedWith("Shipment already exists");
    });
  });

  describe("assignTransporter", function () {
    beforeEach(async function () {
      await contract.connect(admin).createShipment(SHIPMENT_ID);
    });

    it("should assign transporter as admin", async function () {
      await expect(
        contract.connect(admin).assignTransporter(SHIPMENT_ID, transporter.address)
      ).to.emit(contract, "TransporterAssigned");

      const shipment = await contract.shipments(SHIPMENT_ID);
      expect(shipment.currentTransporter).to.equal(transporter.address);
      expect(shipment.status).to.equal(1); // Assigned
    });

    it("should reject assignment from non-admin", async function () {
      await expect(
        contract.connect(transporter).assignTransporter(SHIPMENT_ID, transporter.address)
      ).to.be.revertedWith("Only admin can perform this action");
    });

    it("should reject assignment for non-existent shipment", async function () {
      await expect(
        contract.connect(admin).assignTransporter(99999, transporter.address)
      ).to.be.revertedWith("Shipment does not exist");
    });

    it("should reject assignment with zero address", async function () {
      await expect(
        contract.connect(admin).assignTransporter(SHIPMENT_ID, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid transporter address");
    });

    it("should reject re-assignment of already assigned shipment", async function () {
      await contract.connect(admin).assignTransporter(SHIPMENT_ID, transporter.address);
      await expect(
        contract.connect(admin).assignTransporter(SHIPMENT_ID, other.address)
      ).to.be.revertedWith("Shipment is not in Created state");
    });
  });

  describe("recordPickup", function () {
    beforeEach(async function () {
      await contract.connect(admin).createShipment(SHIPMENT_ID);
      await contract.connect(admin).assignTransporter(SHIPMENT_ID, transporter.address);
    });

    it("should record pickup as assigned transporter", async function () {
      await expect(
        contract.connect(transporter).recordPickup(SHIPMENT_ID)
      ).to.emit(contract, "PickupRecorded");

      const shipment = await contract.shipments(SHIPMENT_ID);
      expect(shipment.status).to.equal(2); // PickedUp
      expect(shipment.currentCustodian).to.equal(transporter.address);
    });

    it("should reject pickup from non-transporter", async function () {
      await expect(
        contract.connect(other).recordPickup(SHIPMENT_ID)
      ).to.be.revertedWith("Only transporter can perform this action");
    });

    it("should reject pickup from wrong transporter", async function () {
      await expect(
        contract.connect(other).recordPickup(SHIPMENT_ID)
      ).to.be.revertedWith("Only transporter can perform this action");
    });

    it("should reject pickup for unassigned shipment", async function () {
      await contract.connect(admin).createShipment(SHIPMENT_ID_2);
      await expect(
        contract.connect(transporter).recordPickup(SHIPMENT_ID_2)
      ).to.be.revertedWith("Shipment is not assigned");
    });
  });

  describe("recordCheckpoint", function () {
    beforeEach(async function () {
      await contract.connect(admin).createShipment(SHIPMENT_ID);
      await contract.connect(admin).assignTransporter(SHIPMENT_ID, transporter.address);
      await contract.connect(transporter).recordPickup(SHIPMENT_ID);
    });

    it("should record checkpoint and transition to InTransit", async function () {
      await expect(
        contract.connect(transporter).recordCheckpoint(SHIPMENT_ID)
      ).to.emit(contract, "CheckpointRecorded");

      const shipment = await contract.shipments(SHIPMENT_ID);
      expect(shipment.status).to.equal(3); // InTransit
    });

    it("should reject checkpoint from non-custodian", async function () {
      await expect(
        contract.connect(other).recordCheckpoint(SHIPMENT_ID)
      ).to.be.revertedWith("Only current custodian can perform this action");
    });
  });

  describe("transferCustody", function () {
    beforeEach(async function () {
      await contract.connect(admin).createShipment(SHIPMENT_ID);
      await contract.connect(admin).assignTransporter(SHIPMENT_ID, transporter.address);
      await contract.connect(transporter).recordPickup(SHIPMENT_ID);
    });

    it("should transfer custody from transporter to warehouse", async function () {
      await expect(
        contract.connect(transporter).transferCustody(SHIPMENT_ID, warehouse.address)
      ).to.emit(contract, "CustodyTransferred");

      const shipment = await contract.shipments(SHIPMENT_ID);
      expect(shipment.currentCustodian).to.equal(warehouse.address);
      expect(shipment.status).to.equal(5); // CustodyTransferred
    });

    it("should reject transfer from non-custodian", async function () {
      await expect(
        contract.connect(other).transferCustody(SHIPMENT_ID, warehouse.address)
      ).to.be.revertedWith("Only current custodian can perform this action");
    });

    it("should reject transfer to zero address", async function () {
      await expect(
        contract.connect(transporter).transferCustody(SHIPMENT_ID, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid custodian address");
    });
  });

  describe("markDelivered", function () {
    beforeEach(async function () {
      await contract.connect(admin).createShipment(SHIPMENT_ID);
      await contract.connect(admin).assignTransporter(SHIPMENT_ID, transporter.address);
      await contract.connect(transporter).recordPickup(SHIPMENT_ID);
      await contract.connect(transporter).transferCustody(SHIPMENT_ID, receiver.address);
    });

    it("should mark shipment as delivered by receiver", async function () {
      await expect(
        contract.connect(receiver).markDelivered(SHIPMENT_ID)
      ).to.emit(contract, "ShipmentDelivered");

      const shipment = await contract.shipments(SHIPMENT_ID);
      expect(shipment.status).to.equal(6); // Delivered
    });

    it("should reject delivery from non-receiver", async function () {
      await expect(
        contract.connect(other).markDelivered(SHIPMENT_ID)
      ).to.be.revertedWith("Only receiver can perform this action");
    });

    it("should reject delivery from receiver who is not custodian", async function () {
      const nonCustodianReceiver = other;
      await contract.connect(owner).grantReceiverRole(nonCustodianReceiver.address);
      await expect(
        contract.connect(nonCustodianReceiver).markDelivered(SHIPMENT_ID)
      ).to.be.revertedWith("Only current custodian can perform this action");
    });
  });

  describe("Full Lifecycle", function () {
    it("should complete full shipment lifecycle", async function () {
      // 1. Create
      await contract.connect(admin).createShipment(SHIPMENT_ID);
      let s = await contract.shipments(SHIPMENT_ID);
      expect(s.status).to.equal(0); // Created

      // 2. Assign
      await contract.connect(admin).assignTransporter(SHIPMENT_ID, transporter.address);
      s = await contract.shipments(SHIPMENT_ID);
      expect(s.status).to.equal(1); // Assigned

      // 3. Pickup
      await contract.connect(transporter).recordPickup(SHIPMENT_ID);
      s = await contract.shipments(SHIPMENT_ID);
      expect(s.status).to.equal(2); // PickedUp

      // 4. Checkpoint (PickedUp -> InTransit)
      await contract.connect(transporter).recordCheckpoint(SHIPMENT_ID);
      s = await contract.shipments(SHIPMENT_ID);
      expect(s.status).to.equal(3); // InTransit

      // 5. Transfer to warehouse
      await contract.connect(transporter).transferCustody(SHIPMENT_ID, warehouse.address);
      s = await contract.shipments(SHIPMENT_ID);
      expect(s.status).to.equal(5); // CustodyTransferred
      expect(s.currentCustodian).to.equal(warehouse.address);

      // 6. Transfer to receiver
      await contract.connect(warehouse).transferCustody(SHIPMENT_ID, receiver.address);
      s = await contract.shipments(SHIPMENT_ID);
      expect(s.status).to.equal(5); // CustodyTransferred
      expect(s.currentCustodian).to.equal(receiver.address);

      // 7. Deliver
      await contract.connect(receiver).markDelivered(SHIPMENT_ID);
      s = await contract.shipments(SHIPMENT_ID);
      expect(s.status).to.equal(6); // Delivered
    });
  });
});
