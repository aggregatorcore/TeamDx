-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "teamLeaderId" TEXT,
    "teamName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_configs" (
    "id" TEXT NOT NULL,
    "roleId" TEXT,
    "userId" TEXT,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "leadId" INTEGER,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "country" TEXT,
    "visaType" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT DEFAULT 'medium',
    "score" INTEGER,
    "notes" TEXT,
    "callStatus" TEXT,
    "callbackScheduledAt" TIMESTAMP(3),
    "discussionType" TEXT,
    "discussionNotes" TEXT,
    "documentsReceived" TEXT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "qualification" TEXT,
    "address" TEXT,
    "passportNumber" TEXT,
    "passportIssueDate" TEXT,
    "passportExpiryDate" TEXT,
    "passportType" TEXT,
    "occupation" TEXT,
    "employerName" TEXT,
    "salary" INTEGER,
    "designation" TEXT,
    "experience" INTEGER,
    "businessName" TEXT,
    "businessType" TEXT,
    "businessAddress" TEXT,
    "travelHistory" TEXT,
    "refusalCount" INTEGER DEFAULT 0,
    "refusalCountry" TEXT,
    "refusalReasons" TEXT,
    "profilePhoto" TEXT,
    "assignedToId" TEXT,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "previousAssignedToId" TEXT,
    "movedAt" TIMESTAMP(3),
    "movedFromRole" TEXT,
    "collaborationActive" BOOLEAN NOT NULL DEFAULT false,
    "shuffleTriedOwnerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shuffleIndex" INTEGER NOT NULL DEFAULT 0,
    "lastHandoffAt" TIMESTAMP(3),
    "isExhausted" BOOLEAN NOT NULL DEFAULT false,
    "exhaustedAt" TIMESTAMP(3),
    "exhaustReason" TEXT,
    "sheetSyncId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_sheet_syncs" (
    "id" TEXT NOT NULL,
    "sheetUrl" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastRowCount" INTEGER NOT NULL DEFAULT 0,
    "syncInterval" INTEGER NOT NULL DEFAULT 5,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_sheet_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "callType" TEXT NOT NULL DEFAULT 'outgoing',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "duration" INTEGER,
    "notes" TEXT,
    "callDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "deviceId" TEXT,
    "initiatedFrom" TEXT,
    "webRequestId" TEXT,
    "autoCreatedLead" BOOLEAN NOT NULL DEFAULT false,
    "recordingPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "clientId" TEXT NOT NULL,
    "visaType" TEXT NOT NULL,
    "targetCountry" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "submissionDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fees" DOUBLE PRECISION,
    "notes" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_visits" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outTime" TIMESTAMP(3),
    "purpose" TEXT NOT NULL,
    "assignedToId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'present',
    "workHours" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewPeriod" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "goals" TEXT,
    "achievements" TEXT,
    "areasForImprovement" TEXT,
    "comments" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'available',
    "totalWorkTime" INTEGER NOT NULL DEFAULT 0,
    "totalBreakTime" INTEGER NOT NULL DEFAULT 0,
    "currentBreakId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "break_records" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "breakType" TEXT NOT NULL,
    "reason" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "break_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_shifts" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "recipientId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "tags" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenType" TEXT DEFAULT 'Bearer',
    "expiryDate" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_duties" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyResponsibilities" TEXT NOT NULL,
    "coreDuties" TEXT NOT NULL,
    "additionalDuties" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_duties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tagValue" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Tag',
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "category" TEXT NOT NULL DEFAULT 'call_status',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "requiresCallback" BOOLEAN NOT NULL DEFAULT false,
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "actions" TEXT,
    "escalations" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "nextTagIds" TEXT,
    "createdById" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "fcmToken" TEXT,
    "phoneNumber" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deviceId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "callId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FOLLOW_UP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "tags" TEXT,
    "source" TEXT,
    "phoneNumber" TEXT,
    "relatedCallId" TEXT,
    "relatedCallRequestId" TEXT,
    "inProgressAt" TIMESTAMP(3),
    "autoCompletedAt" TIMESTAMP(3),
    "leadId" TEXT,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activities" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changes" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "taskId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_applications" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "tagFlowId" TEXT NOT NULL,
    "parentId" TEXT,
    "appliedById" TEXT NOT NULL,
    "note" TEXT,
    "callbackAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_current_tag_states" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "parentTagId" TEXT,
    "childTagId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_current_tag_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_action_instances" (
    "id" TEXT NOT NULL,
    "tagApplicationId" TEXT NOT NULL,
    "tagFlowId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentAttempt" INTEGER NOT NULL DEFAULT 1,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actionRuleJson" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tag_action_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_action_execution_logs" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionParams" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "executionTimeMs" INTEGER,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedBy" TEXT,

    CONSTRAINT "tag_action_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "workflowData" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "roleId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "leadId" TEXT,
    "callId" TEXT,
    "currentNodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executionData" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_action_executions" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "actionNodeId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "attemptNumber" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "resultData" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "workflow_action_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeCode_key" ON "users"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "shift_configs_userId_key" ON "shift_configs"("userId");

-- CreateIndex
CREATE INDEX "shift_configs_roleId_idx" ON "shift_configs"("roleId");

-- CreateIndex
CREATE INDEX "shift_configs_userId_idx" ON "shift_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_leadId_key" ON "leads"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_phone_key" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_assignedToId_idx" ON "leads"("assignedToId");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "google_sheet_syncs_sheetUrl_key" ON "google_sheet_syncs"("sheetUrl");

-- CreateIndex
CREATE INDEX "calls_phoneNumber_idx" ON "calls"("phoneNumber");

-- CreateIndex
CREATE INDEX "calls_createdById_idx" ON "calls"("createdById");

-- CreateIndex
CREATE INDEX "calls_callDate_idx" ON "calls"("callDate");

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_key" ON "clients"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "applications_applicationId_key" ON "applications"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_userId_date_key" ON "attendance"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_currentBreakId_key" ON "user_sessions"("currentBreakId");

-- CreateIndex
CREATE UNIQUE INDEX "role_shifts_roleId_shiftId_key" ON "role_shifts"("roleId", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "google_tokens_userId_key" ON "google_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_duties_userId_key" ON "staff_duties"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_flows_tagValue_category_key" ON "tag_flows"("tagValue", "category");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_userId_key" ON "mobile_devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_deviceId_key" ON "mobile_devices"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "call_requests_callId_key" ON "call_requests"("callId");

-- CreateIndex
CREATE INDEX "call_requests_userId_status_idx" ON "call_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "call_requests_expiresAt_idx" ON "call_requests"("expiresAt");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_dueAt_idx" ON "tasks"("dueAt");

-- CreateIndex
CREATE INDEX "tasks_assignedToId_idx" ON "tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "tasks_leadId_idx" ON "tasks"("leadId");

-- CreateIndex
CREATE INDEX "tasks_phoneNumber_idx" ON "tasks"("phoneNumber");

-- CreateIndex
CREATE INDEX "tasks_source_idx" ON "tasks"("source");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_userId_idx" ON "audit_events"("userId");

-- CreateIndex
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_createdAt_idx" ON "audit_events"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "tag_applications_entityType_entityId_idx" ON "tag_applications"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "tag_applications_tagFlowId_idx" ON "tag_applications"("tagFlowId");

-- CreateIndex
CREATE INDEX "tag_applications_appliedById_idx" ON "tag_applications"("appliedById");

-- CreateIndex
CREATE INDEX "tag_applications_parentId_idx" ON "tag_applications"("parentId");

-- CreateIndex
CREATE INDEX "tag_applications_isActive_createdAt_idx" ON "tag_applications"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lead_current_tag_states_leadId_key" ON "lead_current_tag_states"("leadId");

-- CreateIndex
CREATE INDEX "tag_action_instances_tagApplicationId_idx" ON "tag_action_instances"("tagApplicationId");

-- CreateIndex
CREATE INDEX "tag_action_instances_tagFlowId_idx" ON "tag_action_instances"("tagFlowId");

-- CreateIndex
CREATE INDEX "tag_action_instances_entityType_entityId_idx" ON "tag_action_instances"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "tag_action_instances_status_nextRunAt_idx" ON "tag_action_instances"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "tag_action_instances_status_createdAt_idx" ON "tag_action_instances"("status", "createdAt");

-- CreateIndex
CREATE INDEX "tag_action_execution_logs_instanceId_idx" ON "tag_action_execution_logs"("instanceId");

-- CreateIndex
CREATE INDEX "tag_action_execution_logs_status_executedAt_idx" ON "tag_action_execution_logs"("status", "executedAt");

-- CreateIndex
CREATE INDEX "tag_action_execution_logs_actionType_executedAt_idx" ON "tag_action_execution_logs"("actionType", "executedAt");

-- CreateIndex
CREATE INDEX "workflows_isActive_idx" ON "workflows"("isActive");

-- CreateIndex
CREATE INDEX "workflows_roleId_idx" ON "workflows"("roleId");

-- CreateIndex
CREATE INDEX "workflows_createdById_idx" ON "workflows"("createdById");

-- CreateIndex
CREATE INDEX "workflows_createdAt_idx" ON "workflows"("createdAt");

-- CreateIndex
CREATE INDEX "workflow_executions_workflowId_idx" ON "workflow_executions"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_executions_leadId_idx" ON "workflow_executions"("leadId");

-- CreateIndex
CREATE INDEX "workflow_executions_callId_idx" ON "workflow_executions"("callId");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- CreateIndex
CREATE INDEX "workflow_executions_startedAt_idx" ON "workflow_executions"("startedAt");

-- CreateIndex
CREATE INDEX "workflow_action_executions_executionId_idx" ON "workflow_action_executions"("executionId");

-- CreateIndex
CREATE INDEX "workflow_action_executions_actionNodeId_idx" ON "workflow_action_executions"("actionNodeId");

-- CreateIndex
CREATE INDEX "workflow_action_executions_status_idx" ON "workflow_action_executions"("status");

-- CreateIndex
CREATE INDEX "workflow_action_executions_scheduledAt_idx" ON "workflow_action_executions"("scheduledAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_teamLeaderId_fkey" FOREIGN KEY ("teamLeaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_configs" ADD CONSTRAINT "shift_configs_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_configs" ADD CONSTRAINT "shift_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_previousAssignedToId_fkey" FOREIGN KEY ("previousAssignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_sheetSyncId_fkey" FOREIGN KEY ("sheetSyncId") REFERENCES "google_sheet_syncs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_sheet_syncs" ADD CONSTRAINT "google_sheet_syncs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_visits" ADD CONSTRAINT "client_visits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_visits" ADD CONSTRAINT "client_visits_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_visits" ADD CONSTRAINT "client_visits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_currentBreakId_fkey" FOREIGN KEY ("currentBreakId") REFERENCES "break_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "break_records" ADD CONSTRAINT "break_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_shifts" ADD CONSTRAINT "role_shifts_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_shifts" ADD CONSTRAINT "role_shifts_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_tokens" ADD CONSTRAINT "google_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_duties" ADD CONSTRAINT "staff_duties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_duties" ADD CONSTRAINT "staff_duties_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_flows" ADD CONSTRAINT "tag_flows_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tag_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_flows" ADD CONSTRAINT "tag_flows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_requests" ADD CONSTRAINT "call_requests_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_relatedCallId_fkey" FOREIGN KEY ("relatedCallId") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_relatedCallRequestId_fkey" FOREIGN KEY ("relatedCallRequestId") REFERENCES "call_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activities" ADD CONSTRAINT "task_activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_applications" ADD CONSTRAINT "tag_applications_tagFlowId_fkey" FOREIGN KEY ("tagFlowId") REFERENCES "tag_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_applications" ADD CONSTRAINT "tag_applications_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tag_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_applications" ADD CONSTRAINT "tag_applications_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_current_tag_states" ADD CONSTRAINT "lead_current_tag_states_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_current_tag_states" ADD CONSTRAINT "lead_current_tag_states_parentTagId_fkey" FOREIGN KEY ("parentTagId") REFERENCES "tag_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_current_tag_states" ADD CONSTRAINT "lead_current_tag_states_childTagId_fkey" FOREIGN KEY ("childTagId") REFERENCES "tag_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_action_instances" ADD CONSTRAINT "tag_action_instances_tagApplicationId_fkey" FOREIGN KEY ("tagApplicationId") REFERENCES "tag_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_action_instances" ADD CONSTRAINT "tag_action_instances_tagFlowId_fkey" FOREIGN KEY ("tagFlowId") REFERENCES "tag_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_action_execution_logs" ADD CONSTRAINT "tag_action_execution_logs_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "tag_action_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_action_executions" ADD CONSTRAINT "workflow_action_executions_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
