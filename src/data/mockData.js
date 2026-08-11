// Mock Data for LabTrack - University Laboratory Equipment Management System

export const INITIAL_USERS = [
  {
    id: 'USR-1001',
    name: 'Dr. Robert Vance',
    email: 'admin@university.edu',
    role: 'admin',
    department: 'University Administration',
    universityId: 'ADM-2024-001',
    phone: '+1 (555) 019-2831',
    status: 'Active'
  },
  {
    id: 'USR-1002',
    name: 'Marcus Brody',
    email: 'assistant@university.edu',
    role: 'assistant',
    department: 'Electrical Engineering',
    universityId: 'LAB-2024-042',
    phone: '+1 (555) 014-9921',
    status: 'Active'
  },
  {
    id: 'USR-1003',
    name: 'Prof. Eleanor Vance',
    email: 'faculty@university.edu',
    role: 'faculty',
    department: 'Computer Science & Robotics',
    universityId: 'FAC-2024-108',
    phone: '+1 (555) 018-4432',
    status: 'Active'
  },
  {
    id: 'USR-1004',
    name: 'Alex Johnson',
    email: 'student@university.edu',
    role: 'student',
    department: 'Computer Science B.Tech',
    universityId: 'STU-2024-884',
    phone: '+1 (555) 012-3390',
    status: 'Active'
  },
  {
    id: 'USR-1005',
    name: 'Sarah Connor',
    email: 's.connor@university.edu',
    role: 'student',
    department: 'Robotics Engineering',
    universityId: 'STU-2024-912',
    phone: '+1 (555) 015-7721',
    status: 'Active'
  }
];

export const INITIAL_LABS = [
  {
    id: 'LAB-IOT',
    name: 'IoT & Embedded Systems Lab',
    location: 'Engineering Building Room 302',
    incharge: 'Marcus Brody',
    totalEquipment: 145,
    available: 110,
    borrowed: 28,
    maintenance: 7,
    pendingTransfers: 2,
    description: 'Specialized lab for IoT prototyping, microcontroller programming, and wireless sensor networks.'
  },
  {
    id: 'LAB-ECE',
    name: 'Electronics & VLSI Lab',
    location: 'Science Complex Hall B',
    incharge: 'Dr. Sarah Jenkins',
    totalEquipment: 180,
    available: 140,
    borrowed: 32,
    maintenance: 8,
    pendingTransfers: 1,
    description: 'High-precision oscilloscope workstations, signal generators, and circuit design setups.'
  },
  {
    id: 'LAB-ROB',
    name: 'Robotics & Automation Lab',
    location: 'Innovation Hub Lab 104',
    incharge: 'Prof. Eleanor Vance',
    totalEquipment: 115,
    available: 85,
    borrowed: 24,
    maintenance: 6,
    pendingTransfers: 3,
    description: 'Robotic arms, autonomous vehicles, LiDAR sensors, and computer vision hardware.'
  },
  {
    id: 'LAB-CS',
    name: 'Computer & AI Research Lab',
    location: 'IT Building Floor 4',
    incharge: 'David Miller',
    totalEquipment: 100,
    available: 77,
    borrowed: 14,
    maintenance: 9,
    pendingTransfers: 0,
    description: 'High-performance GPU servers, VR headsets, embedded edge AI kits.'
  }
];

export const INITIAL_EQUIPMENT = [
  {
    id: 'EQ-1001',
    name: 'Arduino Uno R3 Starter Kit',
    category: 'Microcontrollers',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    quantity: 25,
    availableQuantity: 18,
    borrowedQuantity: 7,
    condition: 'Excellent',
    status: 'Available',
    purchaseDate: '2023-09-15',
    description: 'Standard ATmega328P development kit with breadboard, sensors, and connecting cables.',
    serialNumber: 'ARD-UNO-2023-88',
    qrCode: 'EQ-1001'
  },
  {
    id: 'EQ-1002',
    name: 'Raspberry Pi 4 Model B (8GB)',
    category: 'Single Board Computers',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    quantity: 15,
    availableQuantity: 4,
    borrowedQuantity: 11,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2023-11-20',
    description: 'Quad-core Cortex-A72 board with dual 4K micro-HDMI, USB 3.0, and 8GB LPDDR4 SDRAM.',
    serialNumber: 'RPI4-8GB-9021',
    qrCode: 'EQ-1002'
  },
  {
    id: 'EQ-1003',
    name: 'Tektronix 100MHz Digital Oscilloscope',
    category: 'Testing & Measurement',
    labId: 'LAB-ECE',
    labName: 'Electronics & VLSI Lab',
    quantity: 10,
    availableQuantity: 2,
    borrowedQuantity: 8,
    condition: 'Calibration Required',
    status: 'Available',
    purchaseDate: '2022-04-10',
    description: 'Dual-channel 1GS/s digital storage oscilloscope with USB storage and FFT spectrum analyzer.',
    serialNumber: 'TEK-TBS1102-33',
    qrCode: 'EQ-1003'
  },
  {
    id: 'EQ-1004',
    name: 'Rigol DG1022Z Function Generator',
    category: 'Testing & Measurement',
    labId: 'LAB-ECE',
    labName: 'Electronics & VLSI Lab',
    quantity: 8,
    availableQuantity: 6,
    borrowedQuantity: 2,
    condition: 'Excellent',
    status: 'Available',
    purchaseDate: '2023-01-05',
    description: '25MHz dual channel arbitrary waveform function generator with SiFi technology.',
    serialNumber: 'RIG-DG1022-12',
    qrCode: 'EQ-1004'
  },
  {
    id: 'EQ-1005',
    name: 'Weller Digital Soldering Station WESD51',
    category: 'Workshop Tools',
    labId: 'LAB-ECE',
    labName: 'Electronics & VLSI Lab',
    quantity: 12,
    availableQuantity: 10,
    borrowedQuantity: 2,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2022-08-14',
    description: '50W ESD safe microprocessor controlled soldering station with digital display.',
    serialNumber: 'WEL-50W-441',
    qrCode: 'EQ-1005'
  },
  {
    id: 'EQ-1006',
    name: 'Ender 3 V2 3D Printer',
    category: 'Rapid Prototyping',
    labId: 'LAB-ROB',
    labName: 'Robotics & Automation Lab',
    quantity: 4,
    availableQuantity: 0,
    borrowedQuantity: 4,
    condition: 'Under Maintenance',
    status: 'Unavailable',
    purchaseDate: '2023-03-01',
    description: 'FDM 3D printer with silent 32-bit motherboard and textured glass build plate.',
    serialNumber: 'END-3V2-771',
    qrCode: 'EQ-1006'
  },
  {
    id: 'EQ-1007',
    name: 'ESP32 Wi-Fi + Bluetooth NodeMCU',
    category: 'Microcontrollers',
    labId: 'LAB-IOT',
    labName: 'IoT & Embedded Systems Lab',
    quantity: 30,
    availableQuantity: 20,
    borrowedQuantity: 10,
    condition: 'Excellent',
    status: 'Available',
    purchaseDate: '2024-01-10',
    description: 'Dual-core Tensilica LX6 microcontroller with integrated Wi-Fi and BLE stack.',
    serialNumber: 'ESP32-WROOM-32D',
    qrCode: 'EQ-1007'
  },
  {
    id: 'EQ-1008',
    name: '6-DOF Robotic Arm Workstation',
    category: 'Robotics',
    labId: 'LAB-ROB',
    labName: 'Robotics & Automation Lab',
    quantity: 3,
    availableQuantity: 1,
    borrowedQuantity: 2,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2023-06-25',
    description: 'Industrial teaching arm with inverse kinematics interface and suction gripper.',
    serialNumber: 'ROB-ARM-6DOF-03',
    qrCode: 'EQ-1008'
  },
  {
    id: 'EQ-1009',
    name: 'Fluke 87V Industrial Multimeter',
    category: 'Testing & Measurement',
    labId: 'LAB-ECE',
    labName: 'Electronics & VLSI Lab',
    quantity: 20,
    availableQuantity: 16,
    borrowedQuantity: 4,
    condition: 'Excellent',
    status: 'Available',
    purchaseDate: '2023-02-18',
    description: 'True-RMS industrial digital multimeter with low pass filter and temperature sensor.',
    serialNumber: 'FLU-87V-990',
    qrCode: 'EQ-1009'
  },
  {
    id: 'EQ-1010',
    name: 'Oculus Quest 2 VR Headset 256GB',
    category: 'AR / VR',
    labId: 'LAB-CS',
    labName: 'Computer & AI Research Lab',
    quantity: 6,
    availableQuantity: 4,
    borrowedQuantity: 2,
    condition: 'Good',
    status: 'Available',
    purchaseDate: '2023-10-12',
    description: 'Standalone VR headset for immersive simulation and 3D environment modeling.',
    serialNumber: 'OCU-Q2-256-08',
    qrCode: 'EQ-1010'
  }
];

export const INITIAL_TRANSACTIONS = [
  {
    id: 'TXN-9001',
    equipmentId: 'EQ-1002',
    equipmentName: 'Raspberry Pi 4 Model B (8GB)',
    borrowerName: 'Alex Johnson',
    borrowerId: 'STU-2024-884',
    borrowerType: 'Student',
    originLab: 'IoT & Embedded Systems Lab',
    issueDate: '2026-08-01',
    dueDate: '2026-08-15',
    returnDate: null,
    status: 'Issued'
  },
  {
    id: 'TXN-9002',
    equipmentId: 'EQ-1003',
    equipmentName: 'Tektronix 100MHz Digital Oscilloscope',
    borrowerName: 'Prof. Eleanor Vance',
    borrowerId: 'FAC-2024-108',
    borrowerType: 'Faculty',
    originLab: 'Electronics & VLSI Lab',
    issueDate: '2026-07-20',
    dueDate: '2026-08-05',
    returnDate: null,
    status: 'Overdue'
  },
  {
    id: 'TXN-9003',
    equipmentId: 'EQ-1001',
    equipmentName: 'Arduino Uno R3 Starter Kit',
    borrowerName: 'Sarah Connor',
    borrowerId: 'STU-2024-912',
    borrowerType: 'Student',
    originLab: 'IoT & Embedded Systems Lab',
    issueDate: '2026-07-28',
    dueDate: '2026-08-10',
    returnDate: '2026-08-09',
    status: 'Returned'
  },
  {
    id: 'TXN-9004',
    equipmentId: 'EQ-1008',
    equipmentName: '6-DOF Robotic Arm Workstation',
    borrowerName: 'Prof. Eleanor Vance',
    borrowerId: 'FAC-2024-108',
    borrowerType: 'Faculty',
    originLab: 'Robotics & Automation Lab',
    issueDate: '2026-08-05',
    dueDate: '2026-08-25',
    returnDate: null,
    status: 'Issued'
  }
];

export const INITIAL_REQUESTS = [
  {
    id: 'REQ-5001',
    requesterName: 'Alex Johnson',
    requesterId: 'STU-2024-884',
    requesterRole: 'Student',
    department: 'Computer Science B.Tech',
    equipmentId: 'EQ-1007',
    equipmentName: 'ESP32 Wi-Fi + Bluetooth NodeMCU',
    labName: 'IoT & Embedded Systems Lab',
    quantity: 2,
    requestDate: '2026-08-08',
    requiredFrom: '2026-08-11',
    requiredUntil: '2026-08-25',
    purpose: 'Capstone Project - Smart Agriculture IoT Node',
    status: 'Pending'
  },
  {
    id: 'REQ-5002',
    requesterName: 'Prof. Eleanor Vance',
    requesterId: 'FAC-2024-108',
    requesterRole: 'Faculty',
    department: 'Computer Science & Robotics',
    equipmentId: 'EQ-1010',
    equipmentName: 'Oculus Quest 2 VR Headset 256GB',
    labName: 'Computer & AI Research Lab',
    quantity: 1,
    requestDate: '2026-08-07',
    requiredFrom: '2026-08-12',
    requiredUntil: '2026-08-20',
    purpose: 'Virtual Reality Lab Demonstration for CS402',
    status: 'Approved'
  },
  {
    id: 'REQ-5003',
    requesterName: 'Sarah Connor',
    requesterId: 'STU-2024-912',
    requesterRole: 'Student',
    department: 'Robotics Engineering',
    equipmentId: 'EQ-1006',
    equipmentName: 'Ender 3 V2 3D Printer',
    labName: 'Robotics & Automation Lab',
    quantity: 1,
    requestDate: '2026-08-09',
    requiredFrom: '2026-08-15',
    requiredUntil: '2026-08-22',
    purpose: 'RoboWars Frame Rapid Prototyping',
    status: 'Pending'
  }
];

export const INITIAL_TRANSFERS = [
  {
    id: 'TRF-3001',
    requestingLab: 'Robotics & Automation Lab',
    owningLab: 'Electronics & VLSI Lab',
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
    owningLab: 'Computer & AI Research Lab',
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
    title: 'Equipment Overdue Notice',
    message: 'Tektronix Oscilloscope (EQ-1003) issued to Prof. Eleanor Vance was due on Aug 05.',
    timestamp: '10 mins ago',
    type: 'warning',
    read: false
  },
  {
    id: 'NTF-2',
    title: 'New Equipment Request',
    message: 'Alex Johnson submitted a request for 2x ESP32 NodeMCU.',
    timestamp: '2 hours ago',
    type: 'info',
    read: false
  },
  {
    id: 'NTF-3',
    title: 'Inter-Lab Transfer Approved',
    message: 'Transfer of Oculus Quest 2 VR Headset from AI Lab to IoT Lab was approved.',
    timestamp: '1 day ago',
    type: 'success',
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
    aiReasoning: 'High demand anticipated for upcoming Fall Capstone IoT projects based on past semester registration trends.'
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
    aiReasoning: 'Current available stock is critically low (4 units). High course enrollment in Embedded AI.'
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
    aiReasoning: 'Stock level adequate for next 60 days. Maintenance backlog requires attention instead of new purchase.'
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
    aiReasoning: 'Consumable project kit with high turnover during Wireless Networks semester module.'
  }
];

export const REPORT_ANALYTICS_DATA = {
  summaryStats: {
    totalEquipment: 540,
    available: 412,
    borrowed: 98,
    overdue: 30,
    pendingRequests: 17,
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
    { labName: 'IoT Lab', utilization: 78, total: 145 },
    { labName: 'Electronics Lab', utilization: 65, total: 180 },
    { labName: 'Robotics Lab', utilization: 84, total: 115 },
    { labName: 'Computer AI Lab', utilization: 58, total: 100 }
  ],
  mostUsedEquipment: [
    { name: 'Arduino Uno R3 Kit', totalIssues: 142, category: 'Microcontrollers' },
    { name: 'Raspberry Pi 4 (8GB)', totalIssues: 118, category: 'Single Board Computers' },
    { name: 'Tektronix Oscilloscope', totalIssues: 94, category: 'Testing & Measurement' },
    { name: 'Fluke 87V Multimeter', totalIssues: 82, category: 'Testing & Measurement' },
    { name: 'Ender 3 3D Printer', totalIssues: 76, category: 'Rapid Prototyping' }
  ]
};
