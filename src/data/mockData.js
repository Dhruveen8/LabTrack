// Mock Data for LabTrack - University Laboratory Equipment Management System

export const INITIAL_DEPARTMENTS = [
  {
    id: 'DEPT-EE',
    name: 'Department of Electrical & Electronics Engineering',
    code: 'EE',
    hod: 'Dr. Marcus Brody Sr.',
    totalLabs: 2
  },
  {
    id: 'DEPT-CS',
    name: 'Department of Computer Science & Engineering',
    code: 'CS',
    hod: 'Prof. Eleanor Vance',
    totalLabs: 1
  },
  {
    id: 'DEPT-ROB',
    name: 'Department of Robotics & Automation',
    code: 'ROB',
    hod: 'Dr. Sarah Jenkins',
    totalLabs: 1
  }
];

export const INITIAL_USERS = [
  {
    id: 'USR-1001',
    name: 'Dr. Robert Vance',
    email: 'admin@university.edu',
    role: 'admin',
    departmentId: 'DEPT-CS',
    department: 'Department of Computer Science & Engineering',
    universityId: 'ADM-2024-001',
    phone: '+1 (555) 019-2831',
    status: 'Active',
    assignedLabIds: []
  },
  {
    id: 'USR-1002',
    name: 'Marcus Brody',
    email: 'assistant@university.edu',
    role: 'assistant',
    departmentId: 'DEPT-EE',
    department: 'Department of Electrical & Electronics Engineering',
    universityId: 'LAB-2024-042',
    phone: '+1 (555) 014-9921',
    status: 'Active',
    assignedLabIds: ['LAB-IOT', 'LAB-ECE'] // Manages multiple labs in Electrical Dept
  },
  {
    id: 'USR-1003',
    name: 'Prof. Eleanor Vance',
    email: 'faculty@university.edu',
    role: 'faculty',
    departmentId: 'DEPT-CS',
    department: 'Department of Computer Science & Engineering',
    universityId: 'FAC-2024-108',
    phone: '+1 (555) 018-4432',
    status: 'Active',
    assignedLabIds: []
  },
  {
    id: 'USR-1004',
    name: 'Alex Johnson',
    email: 'student@university.edu',
    role: 'student',
    departmentId: 'DEPT-CS',
    department: 'Department of Computer Science & Engineering',
    universityId: 'STU-2024-884',
    phone: '+1 (555) 012-3390',
    status: 'Active',
    assignedLabIds: []
  },
  {
    id: 'USR-1005',
    name: 'Sarah Connor',
    email: 's.connor@university.edu',
    role: 'student',
    departmentId: 'DEPT-ROB',
    department: 'Department of Robotics & Automation',
    universityId: 'STU-2024-912',
    phone: '+1 (555) 015-7721',
    status: 'Active',
    assignedLabIds: []
  }
];

export const INITIAL_LABS = [
  {
    id: 'LAB-IOT',
    name: 'IoT & Embedded Systems Lab',
    departmentId: 'DEPT-EE',
    departmentName: 'Department of Electrical & Electronics Engineering',
    location: 'Engineering Building Room 302',
    inchargeUserId: 'USR-1002',
    incharge: 'Marcus Brody',
    totalEquipment: 70,
    available: 52,
    borrowed: 18,
    maintenance: 0,
    pendingTransfers: 1,
    description: 'Specialized lab for IoT prototyping, microcontroller programming, and wireless sensor networks.'
  },
  {
    id: 'LAB-ECE',
    name: 'Electronics & VLSI Lab',
    departmentId: 'DEPT-EE',
    departmentName: 'Department of Electrical & Electronics Engineering',
    location: 'Science Complex Hall B',
    inchargeUserId: 'USR-1002',
    incharge: 'Marcus Brody',
    totalEquipment: 50,
    available: 38,
    borrowed: 12,
    maintenance: 0,
    pendingTransfers: 1,
    description: 'High-precision oscilloscope workstations, signal generators, and circuit design setups.'
  },
  {
    id: 'LAB-ROB',
    name: 'Robotics & Automation Lab',
    departmentId: 'DEPT-ROB',
    departmentName: 'Department of Robotics & Automation',
    location: 'Innovation Hub Lab 104',
    inchargeUserId: 'USR-1002',
    incharge: 'Marcus Brody',
    totalEquipment: 7,
    available: 3,
    borrowed: 4,
    maintenance: 0,
    pendingTransfers: 1,
    description: 'Robotic arms, autonomous vehicles, LiDAR sensors, and 3D printing equipment.'
  },
  {
    id: 'LAB-CS',
    name: 'Computer & AI Research Lab',
    departmentId: 'DEPT-CS',
    departmentName: 'Department of Computer Science & Engineering',
    location: 'IT Building Floor 4',
    inchargeUserId: 'USR-1002',
    incharge: 'Marcus Brody',
    totalEquipment: 6,
    available: 4,
    borrowed: 2,
    maintenance: 0,
    pendingTransfers: 0,
    description: 'High-performance workstations, VR headsets, and embedded edge AI computing modules.'
  }
];

// Helper to generate initial units for an equipment model
const createInitialUnits = (labCode, catCode, totalQty, borrowedQty = 0, name = '') => {
  const units = [];
  for (let i = 1; i <= totalQty; i++) {
    const seqStr = String(i).padStart(5, '0');
    const assetId = `LT-${labCode}-${catCode}-${seqStr}`;
    const isBorrowed = i <= borrowedQty;
    units.push({
      assetId,
      name,
      status: isBorrowed ? 'Issued' : 'Available',
      condition: 'Excellent',
      serialNumber: `${labCode}-${catCode}-${seqStr}`,
      qrCodeUrl: `https://labtrack.univ.edu/equipment/${assetId}`
    });
  }
  return units;
};

export const INITIAL_EQUIPMENT = [
  {
    id: 'EQ-1001',
    name: 'Arduino Uno R3 Starter Kit',
    category: 'Microcontrollers',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    departmentId: 'DEPT-EE',
    quantity: 25,
    availableQuantity: 18,
    borrowedQuantity: 7,
    condition: 'Excellent',
    status: 'Available',
    purchaseDate: '2023-09-15',
    description: 'Standard ATmega328P development kit with breadboard, sensors, and connecting cables.',
    serialNumber: 'ARD-UNO-2023-88',
    units: createInitialUnits('IOT', 'MC', 25, 7, 'Arduino Uno R3 Starter Kit')
  },
  {
    id: 'EQ-1002',
    name: 'Raspberry Pi 4 Model B (8GB)',
    category: 'Single Board Computers',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    departmentId: 'DEPT-EE',
    quantity: 15,
    availableQuantity: 4,
    borrowedQuantity: 11,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2023-11-20',
    description: 'Quad-core Cortex-A72 board with dual 4K micro-HDMI, USB 3.0, and 8GB LPDDR4 SDRAM.',
    serialNumber: 'RPI4-8GB-9021',
    units: createInitialUnits('IOT', 'SBC', 15, 11, 'Raspberry Pi 4 Model B (8GB)')
  },
  {
    id: 'EQ-1003',
    name: 'Tektronix 100MHz Digital Oscilloscope',
    category: 'Testing & Measurement',
    labId: 'LAB-ECE',
    labName: 'Electronics & VLSI Lab',
    departmentId: 'DEPT-EE',
    quantity: 10,
    availableQuantity: 2,
    borrowedQuantity: 8,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2022-04-10',
    description: 'Dual-channel 1GS/s digital storage oscilloscope with USB storage and FFT spectrum analyzer.',
    serialNumber: 'TEK-TBS1102-33',
    units: createInitialUnits('ECE', 'TM', 10, 8, 'Tektronix 100MHz Digital Oscilloscope')
  },
  {
    id: 'EQ-1004',
    name: 'Rigol DG1022Z Function Generator',
    category: 'Testing & Measurement',
    labId: 'LAB-ECE',
    labName: 'Electronics & VLSI Lab',
    departmentId: 'DEPT-EE',
    quantity: 8,
    availableQuantity: 6,
    borrowedQuantity: 2,
    condition: 'Excellent',
    status: 'Available',
    purchaseDate: '2023-01-05',
    description: '25MHz dual channel arbitrary waveform function generator with SiFi technology.',
    serialNumber: 'RIG-DG1022-12',
    units: createInitialUnits('ECE', 'TM', 8, 2, 'Rigol DG1022Z Function Generator')
  },
  {
    id: 'EQ-1005',
    name: 'Weller Digital Soldering Station WESD51',
    category: 'Workshop Tools',
    labId: 'LAB-ECE',
    labName: 'Electronics & VLSI Lab',
    departmentId: 'DEPT-EE',
    quantity: 12,
    availableQuantity: 10,
    borrowedQuantity: 2,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2022-08-14',
    description: '50W ESD safe microprocessor controlled soldering station with digital display.',
    serialNumber: 'WEL-50W-441',
    units: createInitialUnits('ECE', 'WT', 12, 2, 'Weller Digital Soldering Station WESD51')
  },
  {
    id: 'EQ-1006',
    name: 'Ender 3 V2 3D Printer',
    category: 'Rapid Prototyping',
    labId: 'LAB-ROB',
    labName: 'Robotics & Automation Lab',
    departmentId: 'DEPT-ROB',
    quantity: 4,
    availableQuantity: 2,
    borrowedQuantity: 2,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2023-03-01',
    description: 'FDM 3D printer with silent 32-bit motherboard and textured glass build plate.',
    serialNumber: 'END-3V2-771',
    units: createInitialUnits('ROB', 'RP', 4, 2, 'Ender 3 V2 3D Printer')
  },
  {
    id: 'EQ-1007',
    name: 'ESP32 Wi-Fi + Bluetooth NodeMCU',
    category: 'Microcontrollers',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    departmentId: 'DEPT-EE',
    quantity: 30,
    availableQuantity: 20,
    borrowedQuantity: 10,
    condition: 'Excellent',
    status: 'Available',
    purchaseDate: '2024-01-10',
    description: 'Dual-core Tensilica LX6 microcontroller with integrated Wi-Fi and BLE stack.',
    serialNumber: 'ESP32-WROOM-32D',
    units: createInitialUnits('IOT', 'MC', 30, 10, 'ESP32 Wi-Fi + Bluetooth NodeMCU')
  },
  {
    id: 'EQ-1008',
    name: '6-DOF Robotic Arm Workstation',
    category: 'Robotics',
    labId: 'LAB-ROB',
    labName: 'Robotics & Automation Lab',
    departmentId: 'DEPT-ROB',
    quantity: 3,
    availableQuantity: 1,
    borrowedQuantity: 2,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2023-06-25',
    description: 'Industrial teaching arm with inverse kinematics interface and suction gripper.',
    serialNumber: 'ROB-ARM-6DOF-03',
    units: createInitialUnits('ROB', 'ROB', 3, 2, '6-DOF Robotic Arm Workstation')
  },
  {
    id: 'EQ-1009',
    name: 'Fluke 87V Industrial Multimeter',
    category: 'Testing & Measurement',
    labId: 'LAB-ECE',
    labName: 'Electronics & VLSI Lab',
    departmentId: 'DEPT-EE',
    quantity: 20,
    availableQuantity: 16,
    borrowedQuantity: 4,
    condition: 'Excellent',
    status: 'Available',
    purchaseDate: '2023-02-18',
    description: 'True-RMS industrial digital multimeter with low pass filter and temperature sensor.',
    serialNumber: 'FLU-87V-990',
    units: createInitialUnits('ECE', 'TM', 20, 4, 'Fluke 87V Industrial Multimeter')
  },
  {
    id: 'EQ-1010',
    name: 'Oculus Quest 2 VR Headset 256GB',
    category: 'AR / VR',
    labId: 'LAB-CS',
    labName: 'Computer & AI Research Lab',
    departmentId: 'DEPT-CS',
    quantity: 6,
    availableQuantity: 4,
    borrowedQuantity: 2,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2023-10-12',
    description: 'Standalone VR headset for immersive simulation and 3D environment modeling.',
    serialNumber: 'OCU-Q2-256-08',
    units: createInitialUnits('CS', 'VR', 6, 2, 'Oculus Quest 2 VR Headset 256GB')
  }
];

export const INITIAL_REQUESTS = [
  {
    id: 'REQ-5001',
    requesterName: 'Alex Johnson',
    requesterId: 'STU-2024-884',
    requesterRole: 'student',
    department: 'Department of Computer Science & Engineering',
    equipmentId: 'EQ-1007',
    equipmentName: 'ESP32 Wi-Fi + Bluetooth NodeMCU',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    quantity: 1,
    requestDate: '2026-08-10',
    requiredFrom: '2026-08-12',
    requiredUntil: '2026-08-24', // 12 days (within 14 days limit)
    purpose: 'Capstone Project - Smart Agriculture IoT Node',
    status: 'Pending',
    unitAssetId: null
  },
  {
    id: 'REQ-5002',
    requesterName: 'Prof. Eleanor Vance',
    requesterId: 'FAC-2024-108',
    requesterRole: 'faculty',
    department: 'Department of Computer Science & Engineering',
    equipmentId: 'EQ-1010',
    equipmentName: 'Oculus Quest 2 VR Headset 256GB',
    labId: 'LAB-CS',
    labName: 'Computer & AI Research Lab',
    quantity: 1,
    requestDate: '2026-08-07',
    requiredFrom: '2026-08-10',
    requiredUntil: '2026-08-30', // 20 days (within 30 days limit)
    purpose: 'Virtual Reality Lab Demonstration for CS402',
    status: 'Approved', // Approved by assistant, ready for physical QR pickup!
    unitAssetId: null
  },
  {
    id: 'REQ-5003',
    requesterName: 'Sarah Connor',
    requesterId: 'STU-2024-912',
    requesterRole: 'student',
    department: 'Department of Robotics & Automation',
    equipmentId: 'EQ-1006',
    equipmentName: 'Ender 3 V2 3D Printer',
    labId: 'LAB-ROB',
    labName: 'Robotics & Automation Lab',
    quantity: 1,
    requestDate: '2026-08-09',
    requiredFrom: '2026-08-15',
    requiredUntil: '2026-08-25', // 10 days
    purpose: 'RoboWars Frame Rapid Prototyping',
    status: 'Pending',
    unitAssetId: null
  },
  {
    id: 'REQ-5004',
    requesterName: 'Alex Johnson',
    requesterId: 'STU-2024-884',
    requesterRole: 'student',
    department: 'Department of Computer Science & Engineering',
    equipmentId: 'EQ-1002',
    equipmentName: 'Raspberry Pi 4 Model B (8GB)',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    quantity: 1,
    requestDate: '2026-08-01',
    requiredFrom: '2026-08-01',
    requiredUntil: '2026-08-14', // 13 days
    purpose: 'Edge AI inference testing',
    status: 'Issued',
    unitAssetId: 'LT-IOT-SBC-00001'
  }
];

export const INITIAL_TRANSACTIONS = [
  {
    id: 'TXN-9001',
    requestId: 'REQ-5004',
    equipmentId: 'EQ-1002',
    equipmentName: 'Raspberry Pi 4 Model B (8GB)',
    unitAssetId: 'LT-IOT-SBC-00001',
    borrowerName: 'Alex Johnson',
    borrowerId: 'STU-2024-884',
    borrowerType: 'student',
    labId: 'LAB-IOT',
    originLab: 'IoT & Embedded Systems Lab',
    issueDate: '2026-08-01',
    dueDate: '2026-08-14',
    returnDate: null,
    status: 'Issued',
    reissuedCount: 0
  },
  {
    id: 'TXN-9002',
    requestId: 'REQ-5000',
    equipmentId: 'EQ-1003',
    equipmentName: 'Tektronix 100MHz Digital Oscilloscope',
    unitAssetId: 'LT-ECE-TM-00001',
    borrowerName: 'Prof. Eleanor Vance',
    borrowerId: 'FAC-2024-108',
    borrowerType: 'faculty',
    labId: 'LAB-ECE',
    originLab: 'Electronics & VLSI Lab',
    issueDate: '2026-07-20',
    dueDate: '2026-08-18', // 29 days (within 30 days)
    returnDate: null,
    status: 'Issued',
    reissuedCount: 0
  },
  {
    id: 'TXN-9003',
    requestId: 'REQ-4999',
    equipmentId: 'EQ-1001',
    equipmentName: 'Arduino Uno R3 Starter Kit',
    unitAssetId: 'LT-IOT-MC-00001',
    borrowerName: 'Sarah Connor',
    borrowerId: 'STU-2024-912',
    borrowerType: 'student',
    labId: 'LAB-IOT',
    originLab: 'IoT & Embedded Systems Lab',
    issueDate: '2026-07-28',
    dueDate: '2026-08-10',
    returnDate: '2026-08-09',
    status: 'Returned',
    reissuedCount: 0
  }
];

export const INITIAL_TRANSFERS = [
  {
    id: 'TRF-3001',
    requestingLab: 'Robotics & Automation Lab',
    requestingLabId: 'LAB-ROB',
    owningLab: 'Electronics & VLSI Lab',
    owningLabId: 'LAB-ECE',
    equipmentId: 'EQ-1003',
    equipmentName: 'Tektronix 100MHz Digital Oscilloscope',
    requestedBy: 'Prof. Eleanor Vance',
    purpose: 'Joint Inter-disciplinary Motor Driver Testing',
    requiredFrom: '2026-08-10',
    requiredUntil: '2026-08-18',
    status: 'Pending'
  },
  {
    id: 'TRF-3002',
    requestingLab: 'IoT & Embedded Systems Lab',
    requestingLabId: 'LAB-IOT',
    owningLab: 'Computer & AI Research Lab',
    owningLabId: 'LAB-CS',
    equipmentId: 'EQ-1010',
    equipmentName: 'Oculus Quest 2 VR Headset 256GB',
    requestedBy: 'Marcus Brody',
    purpose: 'Edge AI Computer Vision Calibration',
    requiredFrom: '2026-08-01',
    requiredUntil: '2026-08-08',
    status: 'Approved',
    transferDate: '2026-08-02',
    expectedReturn: '2026-08-08'
  }
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'NTF-1',
    title: 'Bulk Equipment Import Completed',
    message: '23 new sensor & oscilloscope units registered across IoT & VLSI Labs.',
    timestamp: '15 mins ago',
    type: 'success',
    category: 'bulk_import',
    targetRoles: ['admin', 'assistant'],
    read: false
  },
  {
    id: 'NTF-2',
    title: 'Club & Event Batch Issue: Hackathon 2026',
    message: 'Robotics Club checked out 12x microcontrollers & 3D printers for Annual University Hackathon.',
    timestamp: '1 hour ago',
    type: 'info',
    category: 'bulk_event_issue',
    targetRoles: ['admin', 'assistant', 'faculty'],
    read: false
  },
  {
    id: 'NTF-3',
    title: 'New Hardware Model Added',
    message: 'Rigol DS1054Z Digital Oscilloscope (10 units) added to Electronics & VLSI Lab.',
    timestamp: '3 hours ago',
    type: 'info',
    category: 'equipment_addition',
    targetRoles: ['admin', 'assistant'],
    read: false
  },
  {
    id: 'NTF-4',
    title: 'Equipment Return Reminder',
    message: 'Raspberry Pi 4 Model B (LT-IOT-SBC-00001) is due on Aug 14.',
    timestamp: '1 day ago',
    type: 'warning',
    category: 'single_issue',
    targetRoles: ['assistant', 'student'],
    read: false
  },
  {
    id: 'NTF-5',
    title: 'Inter-Lab Transfer Initialized',
    message: 'Transfer request: 1x Tektronix Oscilloscope from VLSI Lab to Robotics Lab.',
    timestamp: '2 days ago',
    type: 'info',
    category: 'inter_lab_transfer',
    targetRoles: ['admin', 'assistant', 'faculty'],
    read: true
  }
];

export const SMART_PROCUREMENT_DATA = [
  {
    id: 'PRC-1',
    equipmentName: 'Arduino Uno R3 Starter Kit',
    category: 'Microcontrollers',
    currentStock: 25,
    monthlyUsage: 37,
    pendingRequests: 12,
    predictedDemand: 42,
    recommendedPurchase: 20,
    confidenceScore: '94%',
    aiReasoning: 'High demand anticipated for upcoming Fall Capstone IoT projects based on course enrollment trends.'
  },
  {
    id: 'PRC-2',
    equipmentName: 'Raspberry Pi 4 Model B (8GB)',
    category: 'Single Board Computers',
    currentStock: 15,
    monthlyUsage: 28,
    pendingRequests: 9,
    predictedDemand: 35,
    recommendedPurchase: 22,
    confidenceScore: '91%',
    aiReasoning: 'Current available stock is critically low (4 units). High course enrollment in Embedded Systems.'
  },
  {
    id: 'PRC-3',
    equipmentName: 'Fluke 87V Multimeter',
    category: 'Testing & Measurement',
    currentStock: 20,
    monthlyUsage: 14,
    pendingRequests: 2,
    predictedDemand: 18,
    recommendedPurchase: 0,
    confidenceScore: '88%',
    aiReasoning: 'Stock level adequate for next 60 days. Regular calibration recommended.'
  },
  {
    id: 'PRC-4',
    equipmentName: 'ESP32 Wi-Fi + Bluetooth NodeMCU',
    category: 'Microcontrollers',
    currentStock: 30,
    monthlyUsage: 45,
    pendingRequests: 18,
    predictedDemand: 55,
    recommendedPurchase: 30,
    confidenceScore: '96%',
    aiReasoning: 'Consumable project kit with high turnover during Wireless Sensor Networks semester module.'
  }
];

export const REPORT_ANALYTICS_DATA = {
  summaryStats: {
    totalEquipment: 133,
    available: 95,
    borrowed: 38,
    overdue: 2,
    pendingRequests: 2,
    totalLabs: 4
  },
  monthlyBorrowingTrends: [
    { month: 'Jan', count: 65 },
    { month: 'Feb', count: 88 },
    { month: 'Mar', count: 120 },
    { month: 'Apr', count: 145 },
    { month: 'May', count: 90 },
    { month: 'Jun', count: 40 },
    { month: 'Jul', count: 75 },
    { month: 'Aug', count: 110 }
  ],
  labUtilization: [
    { labName: 'IoT Lab', utilization: 78, total: 70 },
    { labName: 'Electronics Lab', utilization: 65, total: 50 },
    { labName: 'Robotics Lab', utilization: 84, total: 7 },
    { labName: 'Computer AI Lab', utilization: 58, total: 6 }
  ],
  mostUsedEquipment: [
    { name: 'Arduino Uno R3 Kit', totalIssues: 142, category: 'Microcontrollers' },
    { name: 'Raspberry Pi 4 (8GB)', totalIssues: 118, category: 'Single Board Computers' },
    { name: 'Tektronix Oscilloscope', totalIssues: 94, category: 'Testing & Measurement' },
    { name: 'Fluke 87V Multimeter', totalIssues: 82, category: 'Testing & Measurement' },
    { name: 'Ender 3 3D Printer', totalIssues: 76, category: 'Rapid Prototyping' }
  ]
};
