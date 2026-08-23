import json
import os
from typing import Optional, List, Dict, Any
from web3 import Web3
from web3.contract import Contract
from app.core.config import settings


class BlockchainClient:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(settings.blockchain_rpc_url))
        self.contract_address = Web3.to_checksum_address(settings.contract_address)
        self.private_key = settings.backend_wallet_private_key
        self.account = self.w3.eth.account.from_key(self.private_key)
        self.contract: Optional[Contract] = None
        self._load_abi()

    def _load_abi(self):
        abi_path = os.path.join(os.path.dirname(__file__), "abi.json")
        if os.path.exists(abi_path):
            with open(abi_path, "r") as f:
                abi = json.load(f)
            self.contract = self.w3.eth.contract(address=self.contract_address, abi=abi)
        else:
            self.contract = None

    def is_connected(self) -> bool:
        return self.w3.is_connected()

    def _build_tx(self, func, *args, **kwargs) -> dict:
        nonce = self.w3.eth.get_transaction_count(self.account.address)
        gas_estimate = func(*args, **kwargs).estimate_gas({"from": self.account.address})
        return func(*args, **kwargs).build_transaction({
            "from": self.account.address,
            "nonce": nonce,
            "gas": int(gas_estimate * 1.2),
            "gasPrice": self.w3.eth.gas_price,
            "chainId": self.w3.eth.chain_id,
        })

    def _send_and_wait(self, tx: dict, timeout: int = 30) -> dict:
        signed = self.w3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        try:
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
            return {"tx_hash": tx_hash.hex(), "receipt": receipt, "success": True}
        except Exception as e:
            return {"tx_hash": tx_hash.hex(), "error": str(e), "success": False}

    def create_shipment(self, shipment_id: int) -> dict:
        if not self.contract:
            return {"success": False, "error": "Contract not loaded - ABI missing"}
        func = self.contract.functions.createShipment(shipment_id)
        tx = self._build_tx(func)
        return self._send_and_wait(tx)

    def assign_transporter(self, shipment_id: int, transporter_address: str) -> dict:
        if not self.contract:
            return {"success": False, "error": "Contract not loaded - ABI missing"}
        func = self.contract.functions.assignTransporter(shipment_id, Web3.to_checksum_address(transporter_address))
        tx = self._build_tx(func)
        return self._send_and_wait(tx)

    def record_pickup(self, shipment_id: int) -> dict:
        if not self.contract:
            return {"success": False, "error": "Contract not loaded - ABI missing"}
        func = self.contract.functions.recordPickup(shipment_id)
        tx = self._build_tx(func)
        return self._send_and_wait(tx)

    def record_checkpoint(self, shipment_id: int) -> dict:
        if not self.contract:
            return {"success": False, "error": "Contract not loaded - ABI missing"}
        func = self.contract.functions.recordCheckpoint(shipment_id)
        tx = self._build_tx(func)
        return self._send_and_wait(tx)

    def transfer_custody(self, shipment_id: int, new_custodian_address: str) -> dict:
        if not self.contract:
            return {"success": False, "error": "Contract not loaded - ABI missing"}
        func = self.contract.functions.transferCustody(shipment_id, Web3.to_checksum_address(new_custodian_address))
        tx = self._build_tx(func)
        return self._send_and_wait(tx)

    def mark_delivered(self, shipment_id: int) -> dict:
        if not self.contract:
            return {"success": False, "error": "Contract not loaded - ABI missing"}
        func = self.contract.functions.markDelivered(shipment_id)
        tx = self._build_tx(func)
        return self._send_and_wait(tx)

    def get_shipment_events(self, shipment_id: int) -> List[Dict[str, Any]]:
        if not self.contract:
            return []
        events = []
        event_signatures = [
            "ShipmentCreated",
            "TransporterAssigned",
            "PickupRecorded",
            "CheckpointRecorded",
            "CustodyTransferred",
            "ShipmentDelivered",
        ]
        for event_name in event_signatures:
            try:
                event_abi = getattr(self.contract.events, event_name)
                logs = event_abi().get_logs(
                    argument_filters={"shipmentId": shipment_id},
                    fromBlock=0,
                    toBlock="latest"
                )
                for log in logs:
                    events.append({
                        "event": event_name,
                        "args": dict(log["args"]),
                        "tx_hash": log["transactionHash"].hex(),
                        "block_number": log["blockNumber"],
                    })
            except Exception:
                continue
        return sorted(events, key=lambda x: x["block_number"])


blockchain_client = BlockchainClient()