import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db
from app.db.models import (
    User, RoleEnum, Department, Lab, EquipmentModel, EquipmentUnit,
    UnitStatusEnum, Transaction, TransactionStatusEnum, SystemSetting
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed():
    async for db in get_db():
        try:
            logger.info("Starting database seed process...")

            # 1. Check if admin exists
            result = await db.execute(select(User).where(User.email == "admin@labtrack.edu"))
            admin = result.scalars().first()
            if not admin:
                logger.info("Creating admin user...")
                admin = User(
                    name="System Admin",
                    email="admin@labtrack.edu",
                    role=RoleEnum.ADMIN,
                    hashed_password=get_password_hash("password")
                )
                db.add(admin)
                await db.commit()
                await db.refresh(admin)
            
            # 2. Departments
            dept_result = await db.execute(select(Department).where(Department.code == "EE"))
            dept = dept_result.scalars().first()
            if not dept:
                logger.info("Creating departments...")
                dept1 = Department(name="Electrical Engineering", code="EE")
                dept2 = Department(name="Computer Science", code="CS")
                db.add_all([dept1, dept2])
                await db.commit()
                await db.refresh(dept1)
                dept = dept1
            
            # 3. Users
            faculty_res = await db.execute(select(User).where(User.email == "FCE001@charusat.edu.in"))
            faculty = faculty_res.scalars().first()
            if not faculty:
                logger.info("Creating faculty and assistant...")
                faculty = User(
                    name="Dr. Smith",
                    email="FCE001@charusat.edu.in",
                    role=RoleEnum.FACULTY,
                    department_id=dept.id,
                    hashed_password=get_password_hash("password")
                )
                assistant = User(
                    name="Lab Assistant Bob",
                    email="assistant@labtrack.edu",
                    role=RoleEnum.ASSISTANT,
                    department_id=dept.id,
                    hashed_password=get_password_hash("password")
                )
                db.add_all([faculty, assistant])
                await db.commit()
                await db.refresh(faculty)
                await db.refresh(assistant)
            
            # 4. Lab
            lab_res = await db.execute(select(Lab).where(Lab.code == "IOT"))
            lab = lab_res.scalars().first()
            if not lab:
                logger.info("Creating lab...")
                lab = Lab(
                    name="IoT & Embedded Systems Lab",
                    code="IOT",
                    department_id=dept.id,
                    incharge_user_id=faculty.id,
                    location="Room 401, Building B"
                )
                db.add(lab)
                await db.commit()
                await db.refresh(lab)

            # 5. Equipment Model and Units
            model_res = await db.execute(select(EquipmentModel).where(EquipmentModel.name == "Digital Oscilloscope"))
            model = model_res.scalars().first()
            if not model:
                logger.info("Creating equipment model and units...")
                model = EquipmentModel(
                    name="Digital Oscilloscope",
                    category="Measuring",
                    lab_id=lab.id,
                    total_quantity=2
                )
                db.add(model)
                await db.commit()
                await db.refresh(model)

                unit1 = EquipmentUnit(
                    asset_id="LT-IOT-ME-00001",
                    model_id=model.id,
                    condition="New",
                    status=UnitStatusEnum.AVAILABLE
                )
                unit2 = EquipmentUnit(
                    asset_id="LT-IOT-ME-00002",
                    model_id=model.id,
                    condition="New",
                    status=UnitStatusEnum.AVAILABLE
                )
                db.add_all([unit1, unit2])
                await db.commit()

            # 6. Settings
            setting_res = await db.execute(select(SystemSetting).where(SystemSetting.key == "studentBorrowLimitDays"))
            if not setting_res.scalars().first():
                logger.info("Creating system settings...")
                settings = [
                    SystemSetting(key="studentBorrowLimitDays", value="14"),
                    SystemSetting(key="facultyBorrowLimitDays", value="30"),
                    SystemSetting(key="allowSelfRenewal", value="true"),
                ]
                db.add_all(settings)
                await db.commit()

            logger.info("Database seeding completed successfully.")

        except Exception as e:
            logger.error(f"Error during seeding: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(seed())
