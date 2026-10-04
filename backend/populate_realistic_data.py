import asyncio
import logging
from sqlalchemy.future import select
from sqlalchemy import text
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import get_db
from app.db.models import (
    User, RoleEnum, Department, Lab, EquipmentModel, EquipmentUnit,
    UnitStatusEnum, Transaction, TransactionStatusEnum, SystemSetting,
    EquipmentTypeEnum, Request, RequestStatusEnum
)
from app.core.security import get_password_hash
from datetime import datetime, timedelta, timezone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_realistic_data():
    async for db in get_db():
        try:
            logger.info("Truncating existing data...")
            await db.execute(text("TRUNCATE TABLE transactions, requests, transfers, equipment_units, equipment_models, labs, users, departments, notifications, system_settings RESTART IDENTITY CASCADE;"))
            await db.commit()
            
            logger.info("Data truncated. Inserting genuine data...")

            # Settings
            db.add_all([
                SystemSetting(key="studentBorrowLimitDays", value="14"),
                SystemSetting(key="facultyBorrowLimitDays", value="30"),
                SystemSetting(key="allowSelfRenewal", value="true")
            ])

            # Departments
            dept_ee = Department(name="Electrical and Computer Engineering", code="ECE", hod_name="Dr. James Anderson")
            dept_me = Department(name="Mechanical Engineering", code="ME", hod_name="Dr. Richard Thompson")
            dept_phy = Department(name="Applied Physics", code="PHY", hod_name="Dr. Elena Rostova")
            db.add_all([dept_ee, dept_me, dept_phy])
            await db.flush()

            # Users
            password_hash = get_password_hash("password")
            
            admin = User(name="System Administrator", email="admin@labtrack.edu", role=RoleEnum.ADMIN, hashed_password=password_hash)
            
            fac_ee = User(name="Dr. Sarah Mitchell", email="FEE001@charusat.edu.in", role=RoleEnum.FACULTY, department_id=dept_ee.id, hashed_password=password_hash)
            fac_me = User(name="Dr. Marcus Chang", email="FME001@charusat.edu.in", role=RoleEnum.FACULTY, department_id=dept_me.id, hashed_password=password_hash)
            
            ast_ee = User(name="David Miller", email="dmiller@labtrack.edu", role=RoleEnum.ASSISTANT, department_id=dept_ee.id, hashed_password=password_hash)
            ast_me = User(name="Lisa Wong", email="lwong@labtrack.edu", role=RoleEnum.ASSISTANT, department_id=dept_me.id, hashed_password=password_hash)
            ast_phy = User(name="Carlos Ruiz", email="cruiz@labtrack.edu", role=RoleEnum.ASSISTANT, department_id=dept_phy.id, hashed_password=password_hash)

            stu_1 = User(name="Alex Rivera", email="24EE001@charusat.edu.in", role=RoleEnum.STUDENT, department_id=dept_ee.id, hashed_password=password_hash)
            stu_2 = User(name="Emma Taylor", email="23ME001@charusat.edu.in", role=RoleEnum.STUDENT, department_id=dept_me.id, hashed_password=password_hash)
            
            db.add_all([admin, fac_ee, fac_me, ast_ee, ast_me, ast_phy, stu_1, stu_2])
            await db.flush()

            # Labs
            lab_circuit = Lab(department_id=dept_ee.id, name="Advanced Circuits Laboratory", code="CIR", location="Engineering Bldg 1, Rm 204", incharge_user_id=ast_ee.id)
            lab_vlsi = Lab(department_id=dept_ee.id, name="VLSI & Systems Design Facility", code="VLSI", location="Engineering Bldg 1, Rm 310", incharge_user_id=ast_ee.id)
            lab_rob = Lab(department_id=dept_me.id, name="Robotics and Mechatronics Hub", code="ROB", location="Engineering Bldg 2, Rm 105", incharge_user_id=ast_me.id)
            lab_opt = Lab(department_id=dept_phy.id, name="Optical Characterization Lab", code="OPT", location="Science Complex, Rm 401", incharge_user_id=ast_phy.id)
            
            db.add_all([lab_circuit, lab_vlsi, lab_rob, lab_opt])
            await db.flush()

            # Assign labs to assistants
            ast_ee.assigned_labs = [lab_circuit.id, lab_vlsi.id]
            ast_me.assigned_labs = [lab_rob.id]
            ast_phy.assigned_labs = [lab_opt.id]

            # Equipment Models
            models = []
            def make_model(name, category, lab_id, qty, eq_type=EquipmentTypeEnum.STANDARD):
                m = EquipmentModel(name=name, category=category, lab_id=lab_id, total_quantity=qty, equipment_type=eq_type)
                db.add(m)
                models.append(m)
                return m

            # EE Models
            m_scope = make_model("Keysight InfiniiVision 1000 X-Series", "Oscilloscopes", lab_circuit.id, 8)
            m_psu = make_model("Rigol DP832 Programmable DC Power Supply", "Power Supplies", lab_circuit.id, 10)
            m_fpga = make_model("Xilinx Altera Cyclone IV Development Board", "Development Boards", lab_vlsi.id, 15, EquipmentTypeEnum.QUICK_BORROW)
            
            # ME Models
            m_3d = make_model("Ultimaker S5 Pro Bundle", "Fabrication", lab_rob.id, 2)
            m_motor = make_model("Maxon EC 45 flat Brushless Motor", "Actuators", lab_rob.id, 6)
            
            # PHY Models
            m_laser = make_model("Thorlabs HeNe Laser 632.8 nm", "Lasers", lab_opt.id, 4)

            await db.flush()

            # Equipment Units
            def gen_units(model, prefix):
                units = []
                for i in range(model.total_quantity):
                    units.append(EquipmentUnit(
                        asset_id=f"LT-{prefix}-{model.id:03d}-{i+1:04d}",
                        model_id=model.id,
                        serial_number=f"SN-{prefix}-{model.id}-{i+1000}",
                        status=UnitStatusEnum.AVAILABLE,
                        condition="Good",
                        qr_code_url=f"/qrcodes/LT-{prefix}-{model.id:03d}-{i+1:04d}.png"
                    ))
                return units

            db.add_all(gen_units(m_scope, "CIR-KEY"))
            db.add_all(gen_units(m_psu, "CIR-RIG"))
            db.add_all(gen_units(m_fpga, "VLS-XIL"))
            db.add_all(gen_units(m_3d, "ROB-ULT"))
            db.add_all(gen_units(m_motor, "ROB-MAX"))
            db.add_all(gen_units(m_laser, "OPT-THO"))
            
            await db.flush()

            # Add some active requests and transactions to make dashboard lively
            now = datetime.now()
            
            # Request 1 (Approved -> Issued)
            req1 = Request(
                requester_id=stu_1.id,
                model_id=m_scope.id,
                lab_id=lab_circuit.id,
                status=RequestStatusEnum.ISSUED,
                required_from=now - timedelta(days=2),
                required_until=now + timedelta(days=5)
            )
            db.add(req1)
            await db.flush()
            
            # Find an available scope unit
            scope_unit = await db.execute(select(EquipmentUnit).where(EquipmentUnit.model_id == m_scope.id, EquipmentUnit.status == UnitStatusEnum.AVAILABLE))
            scope_unit = scope_unit.scalars().first()
            if scope_unit:
                scope_unit.status = UnitStatusEnum.ISSUED
                txn1 = Transaction(
                    request_id=req1.id,
                    borrower_id=stu_1.id,
                    unit_asset_id=scope_unit.asset_id,
                    lab_id=lab_circuit.id,
                    status=TransactionStatusEnum.ACTIVE,
                    issue_date=now - timedelta(days=2),
                    due_date=now + timedelta(days=5)
                )
                db.add(txn1)

            # Request 2 (Pending)
            req2 = Request(
                requester_id=stu_2.id,
                model_id=m_3d.id,
                lab_id=lab_rob.id,
                status=RequestStatusEnum.PENDING,
                required_from=now + timedelta(days=1),
                required_until=now + timedelta(days=3)
            )
            db.add(req2)
            
            # Request 3 (Overdue Transaction)
            req3 = Request(
                requester_id=fac_ee.id,
                model_id=m_fpga.id,
                lab_id=lab_vlsi.id,
                status=RequestStatusEnum.ISSUED,
                required_from=now - timedelta(days=40),
                required_until=now - timedelta(days=10)
            )
            db.add(req3)
            await db.flush()
            
            fpga_unit = await db.execute(select(EquipmentUnit).where(EquipmentUnit.model_id == m_fpga.id, EquipmentUnit.status == UnitStatusEnum.AVAILABLE))
            fpga_unit = fpga_unit.scalars().first()
            if fpga_unit:
                fpga_unit.status = UnitStatusEnum.ISSUED
                txn2 = Transaction(
                    request_id=req3.id,
                    borrower_id=fac_ee.id,
                    unit_asset_id=fpga_unit.asset_id,
                    lab_id=lab_vlsi.id,
                    status=TransactionStatusEnum.OVERDUE,
                    issue_date=now - timedelta(days=40),
                    due_date=now - timedelta(days=10)
                )
                db.add(txn2)

            await db.commit()
            logger.info("Genuine data population completed successfully!")

        except Exception as e:
            await db.rollback()
            logger.error(f"Error during realistic seeding: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(seed_realistic_data())
