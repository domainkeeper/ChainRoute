// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ShipmentTracking {

    enum ShipmentStatus {
        Created,
        Assigned,
        PickedUp,
        InTransit,
        CustodyTransferred,
        Delivered
    }

    struct Shipment {
        bool exists;
        address creator;
        address currentTransporter;
        address currentCustodian;
        ShipmentStatus status;
        uint256 createdAt;
    }

    address public owner;

    mapping(uint256 => Shipment) public shipments;

    event ShipmentCreated(
        uint256 indexed shipmentId,
        address indexed creator,
        uint256 timestamp
    );

    event TransporterAssigned(
        uint256 indexed shipmentId,
        address indexed transporter,
        uint256 timestamp
    );

    event PickupRecorded(
        uint256 indexed shipmentId,
        address indexed transporter,
        uint256 timestamp
    );

    event CheckpointRecorded(
        uint256 indexed shipmentId,
        address indexed custodian,
        uint256 timestamp
    );

    event CustodyTransferred(
        uint256 indexed shipmentId,
        address indexed fromCustodian,
        address indexed toCustodian,
        uint256 timestamp
    );

    event ShipmentDelivered(
        uint256 indexed shipmentId,
        address indexed receiver,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier shipmentExists(uint256 shipmentId) {
        require(shipments[shipmentId].exists, "Shipment does not exist");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createShipment(
        uint256 shipmentId
    ) external onlyOwner {
        require(
            !shipments[shipmentId].exists,
            "Shipment already exists"
        );

        shipments[shipmentId] = Shipment({
            exists: true,
            creator: msg.sender,
            currentTransporter: address(0),
            currentCustodian: address(0),
            status: ShipmentStatus.Created,
            createdAt: block.timestamp
        });

        emit ShipmentCreated(
            shipmentId,
            msg.sender,
            block.timestamp
        );
    }

    function assignTransporter(
        uint256 shipmentId,
        address transporter
    )
        external
        onlyOwner
        shipmentExists(shipmentId)
    {
        require(
            shipments[shipmentId].status == ShipmentStatus.Created,
            "Shipment is not in Created state"
        );

        require(
            transporter != address(0),
            "Invalid transporter address"
        );

        shipments[shipmentId].currentTransporter = transporter;
        shipments[shipmentId].status = ShipmentStatus.Assigned;

        emit TransporterAssigned(
            shipmentId,
            transporter,
            block.timestamp
        );
    }

    function recordPickup(
        uint256 shipmentId
    )
        external
        shipmentExists(shipmentId)
    {
        Shipment storage shipment = shipments[shipmentId];

        require(
            shipment.status == ShipmentStatus.Assigned,
            "Shipment is not assigned"
        );

        /*
         For this prototype, the backend owner wallet
         submits blockchain transactions.
        */
        require(
            msg.sender == owner,
            "Only backend owner can record pickup"
        );

        shipment.currentCustodian = shipment.currentTransporter;
        shipment.status = ShipmentStatus.PickedUp;

        emit PickupRecorded(
            shipmentId,
            shipment.currentTransporter,
            block.timestamp
        );
    }

    function recordCheckpoint(
        uint256 shipmentId
    )
        external
        shipmentExists(shipmentId)
    {
        Shipment storage shipment = shipments[shipmentId];

        require(
            shipment.currentCustodian != address(0),
            "No current custodian"
        );

        require(
            msg.sender == owner,
            "Only backend owner can record checkpoint"
        );

        if (shipment.status == ShipmentStatus.PickedUp) {
            shipment.status = ShipmentStatus.InTransit;
        }

        emit CheckpointRecorded(
            shipmentId,
            shipment.currentCustodian,
            block.timestamp
        );
    }

    function transferCustody(
        uint256 shipmentId,
        address newCustodian
    )
        external
        shipmentExists(shipmentId)
    {
        Shipment storage shipment = shipments[shipmentId];

        require(
            msg.sender == owner,
            "Only backend owner can transfer custody"
        );

        require(
            shipment.currentCustodian != address(0),
            "No current custodian"
        );

        require(
            newCustodian != address(0),
            "Invalid custodian address"
        );

        address oldCustodian = shipment.currentCustodian;

        shipment.currentCustodian = newCustodian;
        shipment.status = ShipmentStatus.CustodyTransferred;

        emit CustodyTransferred(
            shipmentId,
            oldCustodian,
            newCustodian,
            block.timestamp
        );
    }

    function markDelivered(
        uint256 shipmentId
    )
        external
        shipmentExists(shipmentId)
    {
        Shipment storage shipment = shipments[shipmentId];

        require(
            msg.sender == owner,
            "Only backend owner can mark delivered"
        );

        require(
            shipment.currentCustodian != address(0),
            "No current custodian"
        );

        shipment.status = ShipmentStatus.Delivered;

        emit ShipmentDelivered(
            shipmentId,
            shipment.currentCustodian,
            block.timestamp
        );
    }
}
