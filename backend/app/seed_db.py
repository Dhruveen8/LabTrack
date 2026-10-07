"""Explicit, atomic demo seed. Never deletes or overwrites an existing database."""
import asyncio
import logging
import os

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from app.core.security import get_password_hash
from app.db.database import AsyncSessionLocal, engine
from app.db.models import (User, RoleEnum, AccountStatusEnum, Department, Lab,
                           LabAssistantAssignment, EquipmentModel, EquipmentUnit,
                           EquipmentTypeEnum, SystemSetting)
from app.services.asset_ids import reserve_asset_ids
from app.startup import DEFAULT_SETTINGS
from app.services.user_ids import next_assistant_number

logger = logging.getLogger(__name__)


async def seed_demo(db, password):
    await db.execute(text('SELECT pg_advisory_xact_lock(48290123)'))
    if (await db.execute(select(SystemSetting.id).where(SystemSetting.key == 'DEMO_DATA_SEEDED'))).first():
        return False
    for model in (User, Department, Lab, EquipmentModel):
        if (await db.execute(select(model).limit(1))).first():
            raise ValueError('Demo seed requires an empty database; existing data will not be changed')
    if len(password) < 12:
        raise ValueError('Set DEMO_SEED_PASSWORD to at least 12 characters')
    hashed = get_password_hash(password)
    departments = [Department(name=name, code=code) for name, code in [
        ('Electrical and Computer Engineering', 'ECE'), ('Mechanical Engineering', 'ME'),
        ('Applied Physics', 'PHY')]]
    db.add_all(departments)
    await db.flush()
    users = []
    fixtures = [
        ('System Administrator', 'admin@labtrack.edu', RoleEnum.ADMIN, None),
        ('Dr. Sarah Mitchell', 'fee001@charusat.ac.in', RoleEnum.FACULTY, 0),
        ('Dr. Marcus Chang', 'fme001@charusat.ac.in', RoleEnum.FACULTY, 1),
        ('David Miller', 'dmiller@charusat.ac.in', RoleEnum.ASSISTANT, 0),
        ('Lisa Wong', 'lwong@charusat.ac.in', RoleEnum.ASSISTANT, 1),
        ('Carlos Ruiz', 'cruiz@charusat.ac.in', RoleEnum.ASSISTANT, 2),
        ('Alex Rivera', '24ee001@charusat.edu.in', RoleEnum.STUDENT, 0),
        ('Emma Taylor', '23me001@charusat.edu.in', RoleEnum.STUDENT, 1),
    ]
    for name, email, role, department in fixtures:
        user = User(name=name, email=email, role=role, hashed_password=hashed,
                    account_status=AccountStatusEnum.ACTIVE,
                    university_id=email.split('@')[0].upper() if role in (RoleEnum.STUDENT, RoleEnum.FACULTY) else None,
                    department_id=departments[department].id if department is not None else None)
        db.add(user)
        if role == RoleEnum.ASSISTANT:
            user.assistant_number = await next_assistant_number(db)
        users.append(user)
    labs = [Lab(name=name, code=code, department_id=departments[dept].id) for name, code, dept in [
        ('Advanced Circuits Laboratory', 'CIR', 0), ('VLSI & Systems Design Facility', 'VLSI', 0),
        ('Robotics and Mechatronics Hub', 'ROB', 1), ('Optical Characterization Lab', 'OPT', 2)]]
    db.add_all(labs)
    await db.flush()
    for lab, assistant in zip(labs, [users[3], users[3], users[4], users[5]]):
        db.add(LabAssistantAssignment(lab_id=lab.id, assistant_id=assistant.id, assigned_by_id=users[0].id))
    equipment = [
        ('Keysight InfiniiVision 1000 X-Series', 'Oscilloscopes', 0, 8, EquipmentTypeEnum.STANDARD),
        ('Rigol DP832 Programmable DC Power Supply', 'Power Supplies', 0, 10, EquipmentTypeEnum.STANDARD),
        ('Cyclone IV Development Board', 'Development Boards', 1, 15, EquipmentTypeEnum.QUICK_BORROW),
        ('Ultimaker S5 Pro Bundle', 'Fabrication', 2, 2, EquipmentTypeEnum.STANDARD),
        ('Maxon EC 45 Brushless Motor', 'Actuators', 2, 6, EquipmentTypeEnum.STANDARD),
        ('Thorlabs HeNe Laser', 'Lasers', 3, 4, EquipmentTypeEnum.STANDARD),
    ]
    for name, category, lab_index, quantity, kind in equipment:
        lab = labs[lab_index]
        model = EquipmentModel(name=name, category=category, lab_id=lab.id, equipment_type=kind)
        db.add(model)
        await db.flush()
        assets = await reserve_asset_ids(db, lab.code, category, quantity)
        db.add_all([EquipmentUnit(asset_id=asset, model_id=model.id, lab_id=lab.id, condition='Good')
                    for asset in assets])
    for key, value in DEFAULT_SETTINGS.items():
        await db.execute(insert(SystemSetting).values(key=key, value=value)
                         .on_conflict_do_nothing(index_elements=[SystemSetting.key]))
    db.add(SystemSetting(key='DEMO_DATA_SEEDED', value='true'))
    await db.flush()
    return True


async def seed():
    try:
        async with AsyncSessionLocal() as db:
            created = await seed_demo(db, os.environ.get('DEMO_SEED_PASSWORD', ''))
            await db.commit()
            logger.info('Demo data created' if created else 'Demo data already exists; no changes')
    finally:
        await engine.dispose()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
