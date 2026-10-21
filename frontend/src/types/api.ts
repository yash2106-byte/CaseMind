// Defines the supported types of issues a customer can report.
export type IssueType = "internet_connectivity";

// Defines all valid states a support case can have.
// Describes the entire support case,
export type CaseStatus = "open" | "in_progress" | "escalated" | "resolved" | "closed";

// Defines the unique identifiers for all supported troubleshooting steps.
export type StepKey =
    | "router_power_cycle"
    | "check_cables_lights"
    | "check_area_outrage"
    | "test_another_device"
    | "remote_line_reset"
    | "book_technician";

// Describes one troubleshooting action within that case.
export type ActionStatus =
    | "recommended"
    | "attempted"
    | "failed"
    | "succeeded"
    | "unknown"
    | "skipped";

// Outcomes a Customer may submit
export type CustomerOutcome = "failed" | "succeeded" | "unknown";

// Defines the types of events recorded in a support case's history.
export type EventType = 
    | "case_created"
    | "contact_started"
    | "message_received"
    | "assistent_response"
    | "action_recommended"
    | "action_outcome_recorded"
    | "case_escalated"
    | "case_resolved"
    | "case_reopened"
    | "summary_generated"

// Categorizes assistant replies by their purpose.
export type ReplyKind = "troubleshooting" | "scope" | "clarification";

// Defines why a support case needs to be escalated.
export type EscalationReason = "contact_limit_reached" | "playbook_exhausted";

// Defines the information stored for each customer.
export interface Customer {
    id: string;
    Name: string;
    email?: string;
    createdAt?: string;
}

// Defines the basic information needed to display a support case.
export interface CaseSummary{
    id: string;
    customerId: string;
    issueType: IssueType;
    title: string;
    status: CaseStatus;
    contactCount: number;
    currentStepKey: StepKey | null;
    createdAt: string;
    updatedAt: string;
    lastContactAt: string; 
}

// Defines a troubleshooting action and tracks its status and outcome.
export interface Action{
    id: string;
    caseId: string;
    stepKey: StepKey;
    stepOrder: number; // 1...6
    label: string;
    instructions: string;
    status: ActionStatus;
    recommendedAt: string;
    outcomeAt: string | null;
    customerNote: string | null;
}

// Defines a historical event and any additional data associated with it.
export interface CaseEvent{
    id: string;
    caseId: string;
    type: EventType;
    message: string;
    metadata: Record<string, unknown>;
    createdAt: string;
}

// Extends the basic case information with optional details, actions, events,
// and information needed when resolving or handing off a case.
export interface CaseDetail extends CaseSummary{
    problemSummary?: string;
    resolvedAt?: string | null;
    promisedDeadline?: string | null;
    handoffSummary?: string | null;
    actions?: Action[];
    events?: CaseEvent[];
}

// Defines the text and category of an assistant's reply.
export interface Reply{
    text: string;
    kind: ReplyKind;
}

//          -----ENDPOINT RESPONSES------

// Defines the API response containing a list of customers.
export interface CustomerResponses{
    customers: Customer[];
} 

// Defines the data required to create a customer support session.
export interface CreateSessionRequest{
    customerId: string;
}

// Defines the data returned after a support session is created.
export interface CreateSessionResponses{
    sessionId: string;
    customerId: string;
    case: CaseSummary | CaseDetail | null ;
    escalationRequired: boolean;
    handoffSummary: string | null;
}

// Defines the customer message sent to the support API.
export interface SendMessageRequest{
    message: string;
}

// Defines the response returned after a customer sends a message.
export interface SendMessageResponse{
    sessionId: string;
    case: CaseDetail | null;
    reply: Reply;
    recommendedAction: Action | null;
    needsOutcome: boolean;
}

// Defines the outcome and optional explanation submitted by the customer.
export interface OutcomeRequest{
    outcome: CustomerOutcome;
    customerNote?: string;
}

// Defines the response returned after a customer submits an action outcome.
export interface OutcomeResponse{
    case: CaseDetail;
    reply: Reply;
    recommendedAction: Action | null;
}

// Defines an API response containing one detailed support case.
export interface CaseResponse{
    case: CaseDetail;
}

// Defines the API response containing the case event timeline.
export interface TimelineResponses{
    events: CaseEvent[];
}

// Defines the information needed to hand off a case to another support agent.
export interface HandoffSummaryResponse{
    caseId: string;
    summary: string;
    contactCount: number;
    failedActions: StepKey[];
    timeline: CaseEvent[];
}

// Defines the metrics used to display support performance on a dashboard.
export interface Dashboardmetrics{
    totalCases: number;
    openCases: number;
    escalatedCases: number;
    resolvedCases: number;
    repeatContactRate: number; //0..1
    repeatedRecommandationRate: number; //0..1 
}

//                  -----Errors-----

// Defines the error codes that the backend API can return.
export type ApiErrorCode = 
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "AI_UNAVAILABLE"
    | "INTERNAL_ERROR";

// Includes backend API errors and frontend-only network or unknown errors.
export type ClientErrorCode = ApiErrorCode | "NETWORK_ERROR" | "UNKNOWN";

// Defines the standard structure of an error response returned by the API.
export interface ApiErrorEnvelope{
    error: { 
        code: ApiErrorCode;
        message: string;
        requestId?: string;
    };
}










