'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Tabs,
  Tab,
  Grid,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type {
  ContactStatus,
  LeadSource,
  LeadStatus,
  PipelineStage,
  PriorityLevel,
  LifecycleStage,
  FollowUpType,
  PreferredCommunication,
} from '@/types/ops';
import type { User } from '@/types/project';

interface ContactFormProps {
  initialData?: {
    first_name?: string;
    last_name?: string;
    email?: string | null;
    phone?: string | null;
    phone_mobile?: string | null;
    job_title?: string | null;
    website?: string | null;
    linkedin_url?: string | null;
    address_street?: string | null;
    address_city?: string | null;
    address_state?: string | null;
    address_zip?: string | null;
    address_country?: string | null;
    lead_source?: LeadSource | null;
    campaign_initiative?: string | null;
    date_first_contacted?: string | null;
    original_inquiry_notes?: string | null;
    lead_status?: LeadStatus | null;
    pipeline_stage?: PipelineStage | null;
    priority_level?: PriorityLevel | null;
    assigned_to?: string | null;
    lifecycle_stage?: LifecycleStage | null;
    last_contact_date?: string | null;
    next_follow_up_date?: string | null;
    follow_up_type?: FollowUpType | null;
    preferred_communication?: PreferredCommunication | null;
    is_decision_maker?: boolean | null;
    budget?: string | null;
    timeline_urgency?: string | null;
    pain_points_needs?: string | null;
    risk_flags?: string | null;
    customer_since_date?: string | null;
    contract_start_date?: string | null;
    contract_end_date?: string | null;
    renewal_date?: string | null;
    subscription_level?: string | null;
    support_rep_csm?: string | null;
    health_score?: number | null;
    nps_score?: number | null;
    notes?: string | null;
    status?: ContactStatus;
  };
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
  validationErrors?: Record<string, string>;
}

export default function ContactForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  error,
  validationErrors = {},
}: ContactFormProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Basic Contact Information
  const [first_name, setFirstName] = useState(initialData?.first_name || '');
  const [last_name, setLastName] = useState(initialData?.last_name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [phone_mobile, setPhoneMobile] = useState(initialData?.phone_mobile || '');
  const [job_title, setJobTitle] = useState(initialData?.job_title || '');
  const [website, setWebsite] = useState(initialData?.website || '');
  const [linkedin_url, setLinkedinUrl] = useState(initialData?.linkedin_url || '');
  const [address_street, setAddressStreet] = useState(initialData?.address_street || '');
  const [address_city, setAddressCity] = useState(initialData?.address_city || '');
  const [address_state, setAddressState] = useState(initialData?.address_state || '');
  const [address_zip, setAddressZip] = useState(initialData?.address_zip || '');
  const [address_country, setAddressCountry] = useState(initialData?.address_country || '');
  const [status, setStatus] = useState<ContactStatus>(initialData?.status || 'active');

  // Lead Source & Marketing
  const [lead_source, setLeadSource] = useState<LeadSource | ''>(initialData?.lead_source || '');
  const [campaign_initiative, setCampaignInitiative] = useState(initialData?.campaign_initiative || '');
  const [date_first_contacted, setDateFirstContacted] = useState(
    initialData?.date_first_contacted ? initialData.date_first_contacted.split('T')[0] : ''
  );
  const [original_inquiry_notes, setOriginalInquiryNotes] = useState(initialData?.original_inquiry_notes || '');

  // Status & Pipeline
  const [lead_status, setLeadStatus] = useState<LeadStatus | ''>(initialData?.lead_status || '');
  const [pipeline_stage, setPipelineStage] = useState<PipelineStage | ''>(initialData?.pipeline_stage || '');
  const [priority_level, setPriorityLevel] = useState<PriorityLevel | ''>(initialData?.priority_level || '');
  const [assigned_to, setAssignedTo] = useState(initialData?.assigned_to || '');
  const [lifecycle_stage, setLifecycleStage] = useState<LifecycleStage | ''>(initialData?.lifecycle_stage || '');

  // Activity Tracking
  const [last_contact_date, setLastContactDate] = useState(
    initialData?.last_contact_date ? initialData.last_contact_date.split('T')[0] : ''
  );
  const [next_follow_up_date, setNextFollowUpDate] = useState(
    initialData?.next_follow_up_date ? initialData.next_follow_up_date.split('T')[0] : ''
  );
  const [follow_up_type, setFollowUpType] = useState<FollowUpType | ''>(initialData?.follow_up_type || '');
  const [preferred_communication, setPreferredCommunication] = useState<PreferredCommunication | ''>(
    initialData?.preferred_communication || ''
  );

  // Preferences & Details
  const [is_decision_maker, setIsDecisionMaker] = useState(initialData?.is_decision_maker || false);
  const [budget, setBudget] = useState(initialData?.budget || '');
  const [timeline_urgency, setTimelineUrgency] = useState(initialData?.timeline_urgency || '');
  const [pain_points_needs, setPainPointsNeeds] = useState(initialData?.pain_points_needs || '');
  const [risk_flags, setRiskFlags] = useState(initialData?.risk_flags || '');

  // Customer Data
  const [customer_since_date, setCustomerSinceDate] = useState(
    initialData?.customer_since_date ? initialData.customer_since_date.split('T')[0] : ''
  );
  const [contract_start_date, setContractStartDate] = useState(
    initialData?.contract_start_date ? initialData.contract_start_date.split('T')[0] : ''
  );
  const [contract_end_date, setContractEndDate] = useState(
    initialData?.contract_end_date ? initialData.contract_end_date.split('T')[0] : ''
  );
  const [renewal_date, setRenewalDate] = useState(
    initialData?.renewal_date ? initialData.renewal_date.split('T')[0] : ''
  );
  const [subscription_level, setSubscriptionLevel] = useState(initialData?.subscription_level || '');
  const [support_rep_csm, setSupportRepCsm] = useState(initialData?.support_rep_csm || '');
  const [health_score, setHealthScore] = useState<string>(initialData?.health_score?.toString() || '');
  const [nps_score, setNpsScore] = useState<string>(initialData?.nps_score?.toString() || '');

  // Notes
  const [notes, setNotes] = useState(initialData?.notes || '');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      // Ignore errors
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      first_name,
      last_name,
      email,
      phone,
      phone_mobile,
      job_title,
      website,
      linkedin_url,
      address_street,
      address_city,
      address_state,
      address_zip,
      address_country,
      lead_source: lead_source || null,
      campaign_initiative,
      date_first_contacted: date_first_contacted || null,
      original_inquiry_notes,
      lead_status: lead_status || null,
      pipeline_stage: pipeline_stage || null,
      priority_level: priority_level || null,
      assigned_to: assigned_to || null,
      lifecycle_stage: lifecycle_stage || null,
      last_contact_date: last_contact_date || null,
      next_follow_up_date: next_follow_up_date || null,
      follow_up_type: follow_up_type || null,
      preferred_communication: preferred_communication || null,
      is_decision_maker,
      budget,
      timeline_urgency,
      pain_points_needs,
      risk_flags,
      customer_since_date: customer_since_date || null,
      contract_start_date: contract_start_date || null,
      contract_end_date: contract_end_date || null,
      renewal_date: renewal_date || null,
      subscription_level,
      support_rep_csm: support_rep_csm || null,
      health_score: health_score ? parseInt(health_score) : null,
      nps_score: nps_score ? parseInt(nps_score) : null,
      notes,
      status,
    });
  };

  const commonTextFieldProps = {
    disabled: loading,
    sx: {
      '& .MuiOutlinedInput-root': {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
        '& fieldset': {
          borderColor: theme.palette.divider,
        },
        '&:hover fieldset': {
          borderColor: theme.palette.text.secondary,
        },
        '&.Mui-focused fieldset': {
          borderColor: theme.palette.text.primary,
        },
      },
      '& .MuiInputLabel-root': {
        color: theme.palette.text.secondary,
      },
      '& .MuiInputLabel-root.Mui-focused': {
        color: theme.palette.text.primary,
      },
    },
  };

  const commonSelectProps = {
    disabled: loading,
    MenuProps: {
      PaperProps: {
        sx: {
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          '& .MuiMenuItem-root': {
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
            '&.Mui-selected': {
              backgroundColor: theme.palette.action.hover,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            },
          },
        },
      },
    },
    sx: {
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.background.default,
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.divider,
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.text.secondary,
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.text.primary,
      },
      '& .MuiSvgIcon-root': {
        color: theme.palette.text.primary,
      },
    },
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error}
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{
          mb: 3,
          borderBottom: `2px solid ${theme.palette.divider}`,
          '& .MuiTab-root': {
            color: theme.palette.text.secondary,
            fontWeight: 500,
            textTransform: 'none',
            '&.Mui-selected': {
              color: theme.palette.text.primary,
              fontWeight: 600,
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: theme.palette.text.primary,
          },
        }}
      >
        <Tab label="Basic Info" />
        <Tab label="Lead Source" />
        <Tab label="Pipeline" />
        <Tab label="Activity" />
        <Tab label="Details" />
        <Tab label="Customer Data" />
      </Tabs>

      {/* Tab 0: Basic Contact Information */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="First Name"
              value={first_name}
              onChange={(e) => setFirstName(e.target.value)}
              required
              error={!!validationErrors.first_name}
              helperText={validationErrors.first_name}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Last Name"
              value={last_name}
              onChange={(e) => setLastName(e.target.value)}
              required
              error={!!validationErrors.last_name}
              helperText={validationErrors.last_name}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Job Title"
              value={job_title}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Phone (Work)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Phone (Mobile)"
              value={phone_mobile}
              onChange={(e) => setPhoneMobile(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="LinkedIn URL"
              value={linkedin_url}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Street Address"
              value={address_street}
              onChange={(e) => setAddressStreet(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="City"
              value={address_city}
              onChange={(e) => setAddressCity(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="State"
              value={address_state}
              onChange={(e) => setAddressState(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="ZIP Code"
              value={address_zip}
              onChange={(e) => setAddressZip(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Country"
              value={address_country}
              onChange={(e) => setAddressCountry(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
              <Select
                {...commonSelectProps}
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value as ContactStatus)}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={4}
            />
          </Grid>
        </Grid>
      )}

      {/* Tab 1: Lead Source & Marketing */}
      {activeTab === 1 && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Lead Source</InputLabel>
              <Select
                {...commonSelectProps}
                value={lead_source}
                label="Lead Source"
                onChange={(e) => setLeadSource(e.target.value as LeadSource)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="Referral">Referral</MenuItem>
                <MenuItem value="Website">Website</MenuItem>
                <MenuItem value="Event">Event</MenuItem>
                <MenuItem value="Social Media">Social Media</MenuItem>
                <MenuItem value="Cold Outreach">Cold Outreach</MenuItem>
                <MenuItem value="Partner">Partner</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Campaign / Initiative"
              value={campaign_initiative}
              onChange={(e) => setCampaignInitiative(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Date First Contacted"
              type="date"
              value={date_first_contacted}
              onChange={(e) => setDateFirstContacted(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Original Inquiry Notes"
              value={original_inquiry_notes}
              onChange={(e) => setOriginalInquiryNotes(e.target.value)}
              multiline
              rows={4}
            />
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Status & Pipeline */}
      {activeTab === 2 && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Lead Status</InputLabel>
              <Select
                {...commonSelectProps}
                value={lead_status}
                label="Lead Status"
                onChange={(e) => setLeadStatus(e.target.value as LeadStatus)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="New">New</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Unqualified">Unqualified</MenuItem>
                <MenuItem value="Nurturing">Nurturing</MenuItem>
                <MenuItem value="Qualified">Qualified</MenuItem>
                <MenuItem value="Meeting Set">Meeting Set</MenuItem>
                <MenuItem value="Proposal Sent">Proposal Sent</MenuItem>
                <MenuItem value="Closed Won">Closed Won</MenuItem>
                <MenuItem value="Closed Lost">Closed Lost</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Pipeline Stage</InputLabel>
              <Select
                {...commonSelectProps}
                value={pipeline_stage}
                label="Pipeline Stage"
                onChange={(e) => setPipelineStage(e.target.value as PipelineStage)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="Lead">Lead</MenuItem>
                <MenuItem value="MQL">MQL</MenuItem>
                <MenuItem value="SQL">SQL</MenuItem>
                <MenuItem value="Meeting">Meeting</MenuItem>
                <MenuItem value="Proposal">Proposal</MenuItem>
                <MenuItem value="Negotiation">Negotiation</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Priority Level</InputLabel>
              <Select
                {...commonSelectProps}
                value={priority_level}
                label="Priority Level"
                onChange={(e) => setPriorityLevel(e.target.value as PriorityLevel)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Critical">Critical</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Lifecycle Stage</InputLabel>
              <Select
                {...commonSelectProps}
                value={lifecycle_stage}
                label="Lifecycle Stage"
                onChange={(e) => setLifecycleStage(e.target.value as LifecycleStage)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="Lead">Lead</MenuItem>
                <MenuItem value="MQL">MQL</MenuItem>
                <MenuItem value="SQL">SQL</MenuItem>
                <MenuItem value="Customer">Customer</MenuItem>
                <MenuItem value="Advocate">Advocate</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Assigned To</InputLabel>
              <Select
                {...commonSelectProps}
                value={assigned_to}
                label="Assigned To"
                onChange={(e) => setAssignedTo(e.target.value)}
                disabled={loading || loadingUsers}
              >
                <MenuItem value="">None</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      )}

      {/* Tab 3: Activity Tracking */}
      {activeTab === 3 && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Last Contact Date"
              type="date"
              value={last_contact_date}
              onChange={(e) => setLastContactDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Next Follow-Up Date"
              type="date"
              value={next_follow_up_date}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Follow-Up Type</InputLabel>
              <Select
                {...commonSelectProps}
                value={follow_up_type}
                label="Follow-Up Type"
                onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="Call">Call</MenuItem>
                <MenuItem value="Email">Email</MenuItem>
                <MenuItem value="Meeting">Meeting</MenuItem>
                <MenuItem value="LinkedIn">LinkedIn</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Preferred Communication</InputLabel>
              <Select
                {...commonSelectProps}
                value={preferred_communication}
                label="Preferred Communication"
                onChange={(e) => setPreferredCommunication(e.target.value as PreferredCommunication)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="Email">Email</MenuItem>
                <MenuItem value="SMS">SMS</MenuItem>
                <MenuItem value="Phone">Phone</MenuItem>
                <MenuItem value="LinkedIn">LinkedIn</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      )}

      {/* Tab 4: Preferences & Details */}
      {activeTab === 4 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={is_decision_maker}
                  onChange={(e) => setIsDecisionMaker(e.target.checked)}
                  disabled={loading}
                  sx={{
                    color: theme.palette.text.primary,
                    '&.Mui-checked': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              }
              label="Decision Maker"
              sx={{ color: theme.palette.text.primary }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Timeline / Urgency"
              value={timeline_urgency}
              onChange={(e) => setTimelineUrgency(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Pain Points / Needs"
              value={pain_points_needs}
              onChange={(e) => setPainPointsNeeds(e.target.value)}
              multiline
              rows={4}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Risk Flags"
              value={risk_flags}
              onChange={(e) => setRiskFlags(e.target.value)}
              multiline
              rows={3}
            />
          </Grid>
        </Grid>
      )}

      {/* Tab 5: Customer Data */}
      {activeTab === 5 && (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Customer Since Date"
              type="date"
              value={customer_since_date}
              onChange={(e) => setCustomerSinceDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Subscription Level"
              value={subscription_level}
              onChange={(e) => setSubscriptionLevel(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Contract Start Date"
              type="date"
              value={contract_start_date}
              onChange={(e) => setContractStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Contract End Date"
              type="date"
              value={contract_end_date}
              onChange={(e) => setContractEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Renewal Date"
              type="date"
              value={renewal_date}
              onChange={(e) => setRenewalDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Support Rep / CSM</InputLabel>
              <Select
                {...commonSelectProps}
                value={support_rep_csm}
                label="Support Rep / CSM"
                onChange={(e) => setSupportRepCsm(e.target.value)}
                disabled={loading || loadingUsers}
              >
                <MenuItem value="">None</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="Health Score (0-100)"
              type="number"
              value={health_score}
              onChange={(e) => setHealthScore(e.target.value)}
              inputProps={{ min: 0, max: 100 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              {...commonTextFieldProps}
              fullWidth
              label="NPS Score (-100 to 100)"
              type="number"
              value={nps_score}
              onChange={(e) => setNpsScore(e.target.value)}
              inputProps={{ min: -100, max: 100 }}
            />
          </Grid>
        </Grid>
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={loading}
          sx={{
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            fontWeight: 600,
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              borderColor: theme.palette.text.primary,
            },
          }}
        >
          {loading ? 'Saving...' : 'Save Contact'}
        </Button>
      </Box>
    </Box>
  );
}

