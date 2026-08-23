"""Initial migration

Revision ID: 001
Revises: 
Create Date: 2026-08-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('admin', 'transporter', 'warehouse_operator', 'distributor', 'receiver', 'viewer', name='userrole'), nullable=False),
        sa.Column('wallet_address', sa.String(length=42), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Create vehicles table
    op.create_table(
        'vehicles',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('plate_number', sa.String(length=50), nullable=False),
        sa.Column('type', sa.String(length=100), nullable=False),
        sa.Column('transporter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['transporter_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plate_number')
    )

    # Create shipments table
    op.create_table(
        'shipments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chain_shipment_ref', sa.BigInteger(), nullable=False),
        sa.Column('manufacturer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('origin', sa.Text(), nullable=False),
        sa.Column('destination', sa.Text(), nullable=False),
        sa.Column('cargo_description', sa.Text(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('current_transporter_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('current_custodian_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('vehicle_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.Enum('CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'AT_WAREHOUSE', 'CUSTODY_TRANSFERRED', 'DELIVERED', name='shipmentstatus'), nullable=False),
        sa.Column('qr_code_value', sa.String(length=255), nullable=False),
        sa.Column('creation_tx_hash', sa.String(length=66), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['current_custodian_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['current_transporter_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['manufacturer_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chain_shipment_ref'),
        sa.UniqueConstraint('qr_code_value')
    )
    op.create_index('ix_shipments_chain_shipment_ref', 'shipments', ['chain_shipment_ref'], unique=False)
    op.create_index('ix_shipments_status', 'shipments', ['status'], unique=False)

    # Create checkpoints table
    op.create_table(
        'checkpoints',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('shipment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('recorded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('location', sa.Text(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('tx_hash', sa.String(length=66), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['recorded_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['shipment_id'], ['shipments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_checkpoints_shipment_id', 'checkpoints', ['shipment_id'], unique=False)

    # Create custody_transfers table
    op.create_table(
        'custody_transfers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('shipment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('to_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tx_hash', sa.String(length=66), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['from_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['shipment_id'], ['shipments.id'], ),
        sa.ForeignKeyConstraint(['to_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_custody_transfers_shipment_id', 'custody_transfers', ['shipment_id'], unique=False)

    # Create shipment_events table
    op.create_table(
        'shipment_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('shipment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.Enum('CREATED', 'ASSIGNED', 'PICKED_UP', 'CHECKPOINT', 'CUSTODY_TRANSFER', 'DELIVERED', name='eventtype'), nullable=False),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tx_hash', sa.String(length=66), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['shipment_id'], ['shipments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_shipment_events_shipment_id', 'shipment_events', ['shipment_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_shipment_events_shipment_id', table_name='shipment_events')
    op.drop_table('shipment_events')
    op.drop_index('ix_custody_transfers_shipment_id', table_name='custody_transfers')
    op.drop_table('custody_transfers')
    op.drop_index('ix_checkpoints_shipment_id', table_name='checkpoints')
    op.drop_table('checkpoints')
    op.drop_index('ix_shipments_status', table_name='shipments')
    op.drop_index('ix_shipments_chain_shipment_ref', table_name='shipments')
    op.drop_table('shipments')
    op.drop_table('vehicles')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS shipmentstatus")
    op.execute("DROP TYPE IF EXISTS eventtype")