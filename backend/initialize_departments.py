"""Reset local development data only after a verified backup, keeping admin accounts.

Run after migrations: python initialize_departments.py --backup <verified.dump> --reset-local-data
Generated test credentials stay in ignored output/private-setup, never source control.
"""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
import secrets

from sqlalchemy import select, text
from app.db.database import AsyncSessionLocal, engine, Base
from app.db.models import User, Department, Lab, LabAssistantAssignment, EquipmentModel, EquipmentUnit, RoleEnum, AccountStatusEnum
from app.core.security import get_password_hash
from app.services.registration_departments import REGISTRATION_DEPARTMENTS
from app.startup import DEFAULT_SETTINGS
from app.db.models import SystemSetting
from app.services.asset_ids import reserve_asset_ids


async def initialize(archive):
    manifest = json.loads(archive.with_suffix('.json').read_text())
    if not manifest.get('restore_verified') or hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['sha256']:
        raise RuntimeError('A verified, unmodified backup is required')
    credentials = []
    output = Path(__file__).resolve().parents[1] / 'output/private-setup'
    output.mkdir(parents=True, exist_ok=True)
    destination = output / f'initial-accounts-{secrets.token_hex(4)}.json'
    async with AsyncSessionLocal() as db:
        async with db.begin():
            await db.execute(text('SELECT pg_advisory_xact_lock(48290123)'))
            admins = (await db.scalars(select(User).where(User.role == RoleEnum.ADMIN))).all()
            saved = [{column.name: getattr(user, column.name) for column in User.__table__.columns} for user in admins]
            # Do not restart sequences: previously issued account tokens must not map to new users.
            names = ', '.join('"' + name + '"' for name in Base.metadata.tables)
            await db.execute(text('TRUNCATE TABLE ' + names + ' CASCADE'))
            db.expunge_all()
            for values in saved:
                values.update(approved_by_id=None, department_id=None, is_hod=False)
                db.add(User(**values))
            await db.flush()
            if not saved:
                password = secrets.token_urlsafe(18)
                admin = User(name='System Administrator', email='admin@example.com', role=RoleEnum.ADMIN,
                    hashed_password=get_password_hash(password), email_domain_exempt=True)
                db.add(admin)
                credentials.append(dict(name=admin.name, email=admin.email, password=password, role='ADMIN'))
            for key, value in DEFAULT_SETTINGS.items():
                db.add(SystemSetting(key=key, value=value))
            hods = {'CE': 'Dr. Nikita Bhatt', 'CSE': 'Dr. Amit Thakkar', 'IT': 'Purvi Prajapati'}
            faculty_names = {'CE': ['Rohan Shah', 'Meera Patel'], 'CSE': ['Arjun Desai', 'Kavya Joshi'], 'IT': ['Neel Mehta', 'Ananya Rao']}
            assistant_names = {'CE': 'Vivek Parmar', 'CSE': 'Sneha Shah', 'IT': 'Harsh Trivedi'}
            for number, (code, name) in enumerate(REGISTRATION_DEPARTMENTS.items(), 1):
                department = Department(code=code, name=name, hod_name=hods[code])
                db.add(department)
                await db.flush()
                people = [(hods[code], f'hod.{code.lower()}@example.com', RoleEnum.FACULTY, True, f'F{code}900'),
                    *[(person, f'faculty.{code.lower()}.{index}@example.com', RoleEnum.FACULTY, False, f'F{code}{index:03d}')
                      for index, person in enumerate(faculty_names[code], 1)],
                    (assistant_names[code], f'assistant.{code.lower()}.1@example.com', RoleEnum.ASSISTANT, False, None)]
                assistant = None
                for person, email, role, is_hod, university_id in people:
                    password = secrets.token_urlsafe(18)
                    user = User(name=person, email=email, role=role, is_hod=is_hod, department_id=department.id,
                        university_id=university_id, assistant_number=number if role == RoleEnum.ASSISTANT else None,
                        account_status=AccountStatusEnum.ACTIVE, email_domain_exempt=True, hashed_password=get_password_hash(password))
                    db.add(user)
                    await db.flush()
                    credentials.append(dict(name=person, email=email, password=password, role='HOD' if is_hod else role.value, department=code))
                    if role == RoleEnum.ASSISTANT:
                        assistant = user
                for index in (1, 2):
                    lab = Lab(name=f'{code} Lab {index}', code=f'{code}L{index}', department_id=department.id)
                    db.add(lab)
                    await db.flush()
                    db.add(LabAssistantAssignment(lab_id=lab.id, assistant_id=assistant.id))
                    for label, category, requires_hod, quantity in [('USB Cable', 'CAB', False, 3), ('Development Board', 'DEV', False, 3), ('Digital Oscilloscope', 'OSC', True, 1)]:
                        model = EquipmentModel(name=label, category=category, lab_id=lab.id, requires_hod_approval=requires_hod,
                            description='Initial sample inventory; lab assistant can adjust the HOD requirement.')
                        db.add(model)
                        await db.flush()
                        for asset_id in await reserve_asset_ids(db, lab.code, category, quantity):
                            db.add(EquipmentUnit(asset_id=asset_id, model_id=model.id, lab_id=lab.id, condition='Excellent'))
            # Write credentials before committing so a write failure rolls back the reset.
            destination.write_text(json.dumps(credentials, indent=2), encoding='utf-8')
    print('Initialized 3 departments, 3 HODs, 6 faculty, 3 assistants, 6 labs and 42 sample units. No students created.')
    print('Existing administrator accounts retained.')
    print(f'Test account credentials: {destination}')
    await engine.dispose()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup', type=Path, required=True)
    parser.add_argument('--reset-local-data', action='store_true', required=True)
    args = parser.parse_args()
    asyncio.run(initialize(args.backup.resolve()))
