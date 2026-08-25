// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract ShipmentTracking is AccessControl {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");
    bytes32 public constant WAREHOUSE_ROLE = keccak256("WAREHOUSE_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RECEIVER_ROLE = keccak256("RECEIVER_ROLE");

    enum ShipmentStatus {
        Created,
        Assigned,
        PickedUp,
        InTransit,
        AtWarehouse,
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

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Only admin can perform this action");
        _;
    }

    modifier onlyTransporter() {
        require(hasRole(TRANSPORTER_ROLE, msg.sender), "Only transporter can perform this action");
        _;
    }

    modifier onlyCustodian(uint256 shipmentId) {
        require(shipments[shipmentId].currentCustodian == msg.sender, "Only current custodian can perform this action");
        _;
    }

    modifier shipmentExists(uint256 shipmentId) {
        require(shipments[shipmentId].exists, "Shipment does not exist");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function createShipment(
        uint256 shipmentId
    ) external onlyAdmin {
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
        onlyAdmin
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
        onlyTransporter
        shipmentExists(shipmentId)
    {
        Shipment storage shipment = shipments[shipmentId];

        require(
            shipment.status == ShipmentStatus.Assigned,
            "Shipment is not assigned"
        );

        require(
            shipment.currentTransporter == msg.sender,
            "Caller is not the assigned transporter"
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
        onlyCustodian(shipmentId)
        shipmentExists(shipmentId)
    {
        Shipment storage shipment = shipments[shipmentId];

        require(
            shipment.currentCustodian != address(0),
            "No current custodian"
        );

        if (shipment.status == ShipmentStatus.PickedUp) {
            shipment.status = ShipmentStatus.InTransit;
        } else if (shipment.status == ShipmentStatus.InTransit) {
            shipment.status = ShipmentStatus.AtWarehouse;
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
        onlyCustodian(shipmentId)
        shipmentExists(shipmentId)
    {
        Shipment storage shipment = shipments[shipmentId];

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
        onlyReceiver
        onlyCustodian(shipmentId)
        shipmentExists(shipmentId)
    {
        Shipment storage shipment = shipments[shipmentId];

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

    modifier onlyReceiver() {
        require(hasRole(RECEIVER_ROLE, msg.sender), "Only receiver can perform this action");
        _;
    }

    function grantAdminRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ADMIN_ROLE, account);
    }

    function grantTransporterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(TRANSPORTER_ROLE, account);
    }

    function grantWarehouseRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(WAREHOUSE_ROLE, account);
    }

    function grantDistributorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(DISTRIBUTOR_ROLE, account);
    }

    function grantReceiverRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RECEIVER_ROLE, account);
    }
}
