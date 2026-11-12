// Public values: the publishable key only lets the browser call the
// dashboard_login / dashboard_data functions, which check credentials first.
export const SUPABASE_URL = 'https://pajjuxknlojwxxvevadw.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_01yLOWq2Nr0rwv19AIl3PA_kfz_CL5h';

export type ArtifactKey = 'drafts' | 'research' | 'handoffs' | 'gho';

export interface ArtifactDef {
  key: ArtifactKey;
  label: string;
  /** cat_met.code values that count as one produced artifact each */
  metricCodes: string[];
  /** Default minutes saved per artifact vs. doing it by hand */
  defaultMinutes: number;
  description: string;
}

// Order = categorical slot order in charts (keep stable: color follows the artifact).
export const ARTIFACTS: ArtifactDef[] = [
  {
    key: 'drafts',
    label: 'Drafts',
    metricCodes: ['copy_draft_auto'],
    defaultMinutes: 10,
    description:
      'Customer reply drafts produced by the plugin (counted when the plugin auto-copies them; manual re-copies are not counted).',
  },
  {
    key: 'research',
    label: 'Research',
    metricCodes: ['generated_research_action', 'generated_research_chat'],
    defaultMinutes: 15,
    description:
      'Case research runs (button or asked in the conversation) across Slack, Zendesk, Jira and internal docs. Tracked since Nov 10.',
  },
  {
    key: 'handoffs',
    label: 'Handoffs',
    metricCodes: ['copy_handoff_auto'],
    defaultMinutes: 10,
    description: 'Case handoff notes produced by the plugin.',
  },
  {
    key: 'gho',
    label: 'GHOs',
    metricCodes: ['copy_gho_auto'],
    defaultMinutes: 15,
    description: 'Global Handovers produced by the plugin.',
  },
];

// Screens with time tracking (metric code -> label).
export const SCREENS: { code: string; label: string }[] = [
  { code: 'screen_conversation', label: 'Conversation' },
  { code: 'screen_research', label: 'Research' },
  { code: 'screen_reply', label: 'Replies' },
  { code: 'screen_new_case', label: 'New case' },
  { code: 'screen_handoff', label: 'Handoff' },
  { code: 'screen_gho', label: 'GHO' },
];

export const CASE_LOGGED = 'case_logged';
