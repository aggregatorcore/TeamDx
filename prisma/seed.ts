import "dotenv/config";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function runSeed(prisma: PrismaClient) {
  console.log("🌱 Starting database seed...");

  // Create Roles
  console.log("Creating roles...");
  
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "Full system access and control",
      level: 1,
      isActive: true,
    },
  });

  const branchManagerRole = await prisma.role.upsert({
    where: { name: "BRANCH_MANAGER" },
    update: {},
    create: {
      name: "BRANCH_MANAGER",
      description: "Manages branch operations and staff",
      level: 2,
      parentId: adminRole.id,
      isActive: true,
    },
  });

  const teamLeaderRole = await prisma.role.upsert({
    where: { name: "TEAM_LEADER" },
    update: {},
    create: {
      name: "TEAM_LEADER",
      description: "Leads telecaller team",
      level: 3,
      parentId: branchManagerRole.id,
      isActive: true,
    },
  });

  const telecallerRole = await prisma.role.upsert({
    where: { name: "TELECALLER" },
    update: {},
    create: {
      name: "TELECALLER",
      description: "Handles customer calls and inquiries",
      level: 4,
      parentId: teamLeaderRole.id,
      isActive: true,
    },
  });

  const counselorRole = await prisma.role.upsert({
    where: { name: "COUNSELOR" },
    update: {},
    create: {
      name: "COUNSELOR",
      description: "Provides immigration counseling services",
      level: 3,
      parentId: branchManagerRole.id,
      isActive: true,
    },
  });

  const receptionistRole = await prisma.role.upsert({
    where: { name: "RECEPTIONIST" },
    update: {},
    create: {
      name: "RECEPTIONIST",
      description: "Front desk operations and client reception",
      level: 3,
      parentId: branchManagerRole.id,
      isActive: true,
    },
  });

  const fillingOfficerRole = await prisma.role.upsert({
    where: { name: "FILLING_OFFICER" },
    update: {},
    create: {
      name: "FILLING_OFFICER",
      description: "Handles document filing and processing",
      level: 3,
      parentId: branchManagerRole.id,
      isActive: true,
    },
  });

  const itTeamRole = await prisma.role.upsert({
    where: { name: "IT_TEAM" },
    update: {},
    create: {
      name: "IT_TEAM",
      description: "Technical support and system maintenance",
      level: 2,
      parentId: adminRole.id,
      isActive: true,
    },
  });

  const hrTeamRole = await prisma.role.upsert({
    where: { name: "HR_TEAM" },
    update: {},
    create: {
      name: "HR_TEAM",
      description: "Human resources management",
      level: 2,
      parentId: adminRole.id,
      isActive: true,
    },
  });

  console.log("✅ Roles created");

  // Create Permissions
  console.log("Creating permissions...");

  const permissions = [
    // User permissions
    { name: "users.create", module: "users", action: "create", description: "Create users" },
    { name: "users.read", module: "users", action: "read", description: "View users" },
    { name: "users.update", module: "users", action: "update", description: "Update users" },
    { name: "users.delete", module: "users", action: "delete", description: "Delete users" },
    
    // Application permissions
    { name: "applications.create", module: "applications", action: "create", description: "Create applications" },
    { name: "applications.read", module: "applications", action: "read", description: "View applications" },
    { name: "applications.update", module: "applications", action: "update", description: "Update applications" },
    { name: "applications.delete", module: "applications", action: "delete", description: "Delete applications" },
    
    // Client permissions
    { name: "clients.create", module: "clients", action: "create", description: "Create clients" },
    { name: "clients.read", module: "clients", action: "read", description: "View clients" },
    { name: "clients.update", module: "clients", action: "update", description: "Update clients" },
    { name: "clients.delete", module: "clients", action: "delete", description: "Delete clients" },
    
    // Role permissions
    { name: "roles.manage", module: "roles", action: "manage", description: "Manage roles and permissions" },
    { name: "roles.read", module: "roles", action: "read", description: "View roles" },
    
    // Report permissions
    { name: "reports.view", module: "reports", action: "view", description: "View reports" },
    { name: "reports.generate", module: "reports", action: "generate", description: "Generate reports" },
    
    // Call permissions
    { name: "calls.create", module: "calls", action: "create", description: "Create calls" },
    { name: "calls.read", module: "calls", action: "read", description: "View calls" },
    { name: "calls.update", module: "calls", action: "update", description: "Update calls" },
  ];

  const createdPermissions = [];
  for (const perm of permissions) {
    const permission = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
    createdPermissions.push(permission);
  }

  console.log("✅ Permissions created");

  // Assign all permissions to ADMIN role
  console.log("Assigning permissions to ADMIN role...");
  for (const permission of createdPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Assign basic permissions to other roles
  const basicPermissions = createdPermissions.filter(
    (p) => p.action === "read" || p.module === "applications" || p.module === "clients"
  );

  // Branch Manager gets most permissions
  const branchManagerPermissions = createdPermissions.filter(
    (p) => p.name !== "roles.manage" && p.name !== "users.delete"
  );
  for (const permission of branchManagerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: branchManagerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: branchManagerRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Counselor gets application and client permissions
  const counselorPermissions = createdPermissions.filter(
    (p) => p.module === "applications" || p.module === "clients"
  );
  for (const permission of counselorPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: counselorRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: counselorRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Telecaller gets calls and clients read
  const telecallerPermissions = createdPermissions.filter(
    (p) => (p.module === "calls" || p.module === "clients") && p.action === "read"
  );
  for (const permission of telecallerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: telecallerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: telecallerRole.id,
        permissionId: permission.id,
      },
    });
  }

  console.log("✅ Permissions assigned to roles");

  // Create Admin User
  console.log("Creating admin user...");
  const adminPassword = await hashPassword("admin123"); // Change this in production!
  
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@immigration.com" },
    update: {},
    create: {
      email: "admin@immigration.com",
      password: adminPassword,
      firstName: "Admin",
      lastName: "User",
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log("✅ Admin user created");
  console.log("📧 Email: admin@immigration.com");
  console.log("🔑 Password: admin123");
  console.log("⚠️  Please change the admin password after first login!");

  // Create Tag Flows
  console.log("Creating tag flows...");
  
  // 7 Main Categories with ~40 Sub-Tags
  const tagFlows = [
    // 1️⃣ INTERESTED - 8 Sub-Stages
    {
      name: "Ready to Process",
      description: "Move to Counselor queue, No Call Back, Status: Immediate handover",
      tagValue: "ready_to_process",
      icon: "CheckCircle2",
      color: "#10B981", // green
      category: "interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: "COUNSELOR",
        scheduleCallback: false,
        closeLead: false,
      }),
    },
    {
      name: "Documents Ready",
      description: "Move to Documentation Officer, No Call Back, Status: File start",
      tagValue: "documents_ready",
      icon: "FileText",
      color: "#3B82F6", // blue
      category: "interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: "FILLING_OFFICER",
        scheduleCallback: false,
        closeLead: false,
      }),
    },
    {
      name: "Documents Pending",
      description: "Call Back: YES (date & time mandatory), No Move, Status: Follow-up",
      tagValue: "documents_pending",
      icon: "Clock",
      color: "#F59E0B", // orange
      category: "interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Need Counselor Call",
      description: "Call Back: YES (same day / next day), Move to Counselor (after call), Status: Soft handover",
      tagValue: "need_counselor_call",
      icon: "Phone",
      color: "#8B5CF6", // purple
      category: "interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: "COUNSELOR",
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Need Senior Discussion",
      description: "No Call Back, Move to Senior / Branch Manager, Status: Escalation",
      tagValue: "need_senior_discussion",
      icon: "Users",
      color: "#EF4444", // red
      category: "interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: "BRANCH_MANAGER",
        scheduleCallback: false,
        closeLead: false,
      }),
    },
    {
      name: "Budget Issue",
      description: "Call Back: YES, No Move, Status: Price discussion follow-up",
      tagValue: "budget_issue",
      icon: "AlertCircle",
      color: "#F97316", // orange-red
      category: "interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Eligibility Check Pending",
      description: "Call Back: YES, No Move, Status: Verification wait",
      tagValue: "eligibility_check_pending",
      icon: "Clock",
      color: "#6366F1", // indigo
      category: "interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Interested but Later",
      description: "Call Back: YES (future date), No Move, Status: Long follow-up",
      tagValue: "interested_but_later",
      icon: "Calendar",
      color: "#14B8A6", // teal
      category: "interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: true,
      requiresFollowUp: true,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    
    // 2️⃣ NOT INTERESTED - 7 Sub-Tags
    {
      name: "Not Planning Now",
      description: "Not interested at this time",
      tagValue: "not_planning_now",
      icon: "X",
      color: "#EF4444", // red
      category: "not_interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    
    // 2️⃣ NOT INTERESTED - 7 Sub-Tags (All close lead)
    {
      name: "Not Planning Now",
      description: "Not interested at this time",
      tagValue: "not_planning_now",
      icon: "X",
      color: "#EF4444", // red
      category: "not_interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "No Budget",
      description: "Budget constraints",
      tagValue: "no_budget",
      icon: "AlertCircle",
      color: "#F97316", // orange
      category: "not_interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Already Applied",
      description: "Already applied elsewhere",
      tagValue: "already_applied",
      icon: "FileCheck",
      color: "#6366F1", // indigo
      category: "not_interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Already Abroad",
      description: "Already living abroad",
      tagValue: "already_abroad",
      icon: "Globe",
      color: "#8B5CF6", // purple
      category: "not_interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Family Not Agree",
      description: "Family disagreement",
      tagValue: "family_not_agree",
      icon: "Users",
      color: "#F59E0B", // orange
      category: "not_interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Not Eligible",
      description: "Eligibility criteria not met",
      tagValue: "not_eligible",
      icon: "X",
      color: "#EF4444", // red
      category: "not_interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Just Enquiry",
      description: "Only information seeking",
      tagValue: "just_enquiry",
      icon: "MessageSquare",
      color: "#6B7280", // gray
      category: "not_interested",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    
    // 3️⃣ CALL BACK - 5 Sub-Tags (All schedule callback)
    {
      name: "Call Back Today",
      description: "Callback scheduled for today",
      tagValue: "call_back_today",
      icon: "Clock",
      color: "#3B82F6", // blue
      category: "call_back",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Call Back Tomorrow",
      description: "Callback scheduled for tomorrow",
      tagValue: "call_back_tomorrow",
      icon: "Calendar",
      color: "#8B5CF6", // purple
      category: "call_back",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Call Back Later",
      description: "Callback scheduled for later date",
      tagValue: "call_back_later",
      icon: "Calendar",
      color: "#6366F1", // indigo
      category: "call_back",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Asked to WhatsApp",
      description: "Requested WhatsApp communication",
      tagValue: "asked_to_whatsapp",
      icon: "MessageSquare",
      color: "#10B981", // green
      category: "call_back",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: false,
      }),
    },
    {
      name: "Asked to Email",
      description: "Requested email communication",
      tagValue: "asked_to_email",
      icon: "Mail",
      color: "#3B82F6", // blue
      category: "call_back",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: false,
      }),
    },
    
    // 4️⃣ BUSY / NO RESPONSE - 5 Sub-Tags (All schedule callback - auto suggested)
    {
      name: "Busy",
      description: "Customer is busy",
      tagValue: "busy",
      icon: "Phone",
      color: "#F59E0B", // orange
      category: "busy_no_response",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "No Answer",
      description: "No answer to call",
      tagValue: "no_answer",
      icon: "PhoneOff",
      color: "#6B7280", // gray
      category: "busy_no_response",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    // Wrong Number — call_status so it appears in workflow tag list; CLOSE + exhaust (senior bucket)
    {
      name: "Wrong Number",
      description: "Wrong or invalid number; lead moved to Exhaust for senior review",
      tagValue: "wrong_number",
      icon: "wrongnumber",
      color: "#dc2626",
      category: "call_status",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Call Rejected",
      description: "Call was rejected",
      tagValue: "call_rejected",
      icon: "X",
      color: "#EF4444", // red
      category: "busy_no_response",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Call Disconnected",
      description: "Call got disconnected",
      tagValue: "call_disconnected",
      icon: "PhoneOff",
      color: "#F97316", // orange-red
      category: "busy_no_response",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Ringing No Response",
      description: "Phone ringing but no response",
      tagValue: "ringing_no_response",
      icon: "Phone",
      color: "#6B7280", // gray
      category: "busy_no_response",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    
    // 5️⃣ SWITCH OFF / NOT REACHABLE - 3 Sub-Tags (All schedule callback - attempt-based)
    {
      name: "Switch Off",
      description: "Phone is switched off",
      tagValue: "switch_off",
      icon: "WifiOff",
      color: "#6B7280", // gray
      category: "switch_off_not_reachable",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Out of Coverage",
      description: "Out of network coverage",
      tagValue: "out_of_coverage",
      icon: "WifiOff",
      color: "#6B7280", // gray
      category: "switch_off_not_reachable",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    {
      name: "Phone Not Reachable",
      description: "Phone not reachable",
      tagValue: "phone_not_reachable",
      icon: "PhoneOff",
      color: "#6B7280", // gray
      category: "switch_off_not_reachable",
      isActive: true,
      isExclusive: false,
      requiresNote: false,
      requiresCallback: true,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: true,
        closeLead: false,
      }),
    },
    
    // 6️⃣ DISCUSSION - 3 Sub-Tags (Move to specific role)
    {
      name: "Discussion with Counselor",
      description: "Needs discussion with counselor",
      tagValue: "discussion_with_counselor",
      icon: "Users",
      color: "#8B5CF6", // purple
      category: "discussion",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: "COUNSELOR",
        scheduleCallback: false,
        closeLead: false,
      }),
    },
    {
      name: "Discussion with Senior",
      description: "Needs discussion with senior",
      tagValue: "discussion_with_senior",
      icon: "Users",
      color: "#6366F1", // indigo
      category: "discussion",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: "BRANCH_MANAGER",
        scheduleCallback: false,
        closeLead: false,
      }),
    },
    {
      name: "Discussion with Branch Manager",
      description: "Needs discussion with branch manager",
      tagValue: "discussion_with_branch_manager",
      icon: "Users",
      color: "#EF4444", // red
      category: "discussion",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: "BRANCH_MANAGER",
        scheduleCallback: false,
        closeLead: false,
      }),
    },
    
    // 7️⃣ INVALID / CLOSED - 4 Sub-Tags
    {
      name: "Invalid Number",
      description: "Phone number is invalid",
      tagValue: "invalid_number",
      icon: "X",
      color: "#EF4444", // red
      category: "invalid_closed",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Wrong Number",
      description: "Wrong phone number",
      tagValue: "wrong_number",
      icon: "AlertCircle",
      color: "#F97316", // orange
      category: "invalid_closed",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Duplicate Lead",
      description: "Duplicate lead entry",
      tagValue: "duplicate_lead",
      icon: "FileX",
      color: "#6B7280", // gray
      category: "invalid_closed",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
    {
      name: "Do Not Call (DNC)",
      description: "Do not call request",
      tagValue: "do_not_call",
      icon: "PhoneOff",
      color: "#EF4444", // red
      category: "invalid_closed",
      isActive: true,
      isExclusive: false,
      requiresNote: true,
      requiresCallback: false,
      requiresFollowUp: false,
      actions: JSON.stringify({
        moveTo: null,
        scheduleCallback: false,
        closeLead: true,
      }),
    },
  ];

  for (const tagFlow of tagFlows) {
    await prisma.tagFlow.upsert({
      where: {
        tagValue_category: {
          tagValue: tagFlow.tagValue,
          category: tagFlow.category,
        },
      },
      update: tagFlow,
      create: tagFlow,
    });
  }

  console.log(`✅ Created ${tagFlows.length} tag flows`);
  console.log("🎉 Database seed completed successfully!");
}

async function getPrisma(): Promise<PrismaClient> {
  try {
    const m = await import("../server/src/lib/prisma");
    return m.prisma;
  } catch {
    const { PrismaClient } = await import("@prisma/client");
    return new PrismaClient();
  }
}

getPrisma()
  .then(async (p) => {
    await runSeed(p);
    await p.$disconnect();
  })
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  });

