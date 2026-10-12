'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
  Mail,
  Users,
  RefreshCw,
  X,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { useAdminSeason } from '../../../contexts/AdminSeasonContext';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { EmptyState } from '../../../components/shared/EmptyState';
import { trpcQuery, trpcMutation } from '../../../lib/adminApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportPreview {
  totalRows: number;
  newMembers: number;
  existingMembers: number;
  membersWithoutEmail: number;
  paymentRecords: number;
  warnings: string[];
}

interface ImportResult {
  membersCreated: number;
  membersUpdated: number;
  enrollmentsCreated: number;
  paymentsRecorded: number;
  errors: string[];
}

interface EmailListResult {
  count: number;
  members: { name: string; email: string }[];
  emailOnly: string;
}

interface GoogleSheetSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  updatedSheets: Array<{ title: string; rows: number }>;
  memberCount: number;
  paymentCount: number;
  season: { id: string; year: number; name: string };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------


type Tab = 'import' | 'export';

const emailFilterOptions = [
  { value: 'all', label: 'All Members' },
  { value: 'unpaid_dues', label: 'Unpaid Dues' },
  { value: 'no_ticket', label: 'No Ticket' },
  { value: 'not_on_whatsapp', label: 'Not on WhatsApp' },
  { value: 'build_crew', label: 'Build Crew' },
  { value: 'strike_crew', label: 'Strike Crew' },
  { value: 'virgins', label: 'Virgins (First-Timers)' },
  { value: 'no_preapproval', label: 'No Pre-Approval' },
];

export default function ImportExportPage() {
  const { selectedSeasonId } = useAdminSeason();
  const [activeTab, setActiveTab] = useState<Tab>('import');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="admin-page-header">
        <h1 className="text-display-thin text-3xl text-ink">Import / Export</h1>
        <p className="text-body-relaxed text-sm text-ink-soft mt-1">
          Import member data from Excel or export season data and email lists.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        {(['import', 'export'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-sage text-white'
                : 'bg-white border border-tan/40 text-ink-soft hover:bg-cream'
            }`}
          >
            {tab === 'import' ? (
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'import' ? (
          <motion.div
            key="import"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ImportTab seasonId={selectedSeasonId} />
          </motion.div>
        ) : (
          <motion.div
            key="export"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ExportTab seasonId={selectedSeasonId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================================================
// Import Tab
// ===========================================================================

function ImportTab({ seasonId }: { seasonId: string | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setPreviewError('Please select an .xlsx file.');
      return;
    }

    setSelectedFile(file);
    setPreview(null);
    setImportResult(null);
    setImportError(null);
    setPreviewError(null);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setFileBase64(base64);

      // Preview
      try {
        setPreviewLoading(true);
        const result = await trpcMutation<ImportPreview>('import.preview', {
          fileBase64: base64,
          seasonId: seasonId || undefined,
        });
        setPreview(result);
      } catch (err) {
        setPreviewError(
          err instanceof Error ? err.message : 'Failed to preview file. Please check the file format.',
        );
      } finally {
        setPreviewLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [seasonId]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleExecuteImport = async () => {
    if (!fileBase64) return;

    try {
      setExecuteLoading(true);
      setImportError(null);

      const result = await trpcMutation<ImportResult>('import.execute', {
        fileBase64,
        seasonId: seasonId || undefined,
      });
      setImportResult(result);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Import failed. Please try again.',
      );
    } finally {
      setExecuteLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileBase64(null);
    setPreview(null);
    setPreviewError(null);
    setImportResult(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div className="luxury-card p-6">
        <h2 className="text-display-thin text-lg text-ink mb-4">Upload Excel File</h2>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${
            isDragging
              ? 'border-gold bg-gold/5'
              : selectedFile
                ? 'border-green-300 bg-green-50/50'
                : 'border-tan/40 hover:border-sage/40 hover:bg-cream/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="sr-only"
          />

          {selectedFile ? (
            <>
              <FileSpreadsheet className="h-10 w-10 text-green-500 mb-3" />
              <p className="text-sm font-medium text-ink">{selectedFile.name}</p>
              <p className="text-xs text-ink-soft mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="mt-3 text-xs font-medium text-ink-soft hover:text-ink transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Remove
              </button>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-ink-soft/40 mb-3" />
              <p className="text-sm font-medium text-ink">
                Drop your .xlsx file here or click to browse
              </p>
              <p className="text-xs text-ink-soft mt-1">
                Supports the Master Document spreadsheet format (a &apos;Members&apos; sheet and an optional &apos;Dues&apos; sheet)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Preview Loading */}
      {previewLoading && (
        <div className="luxury-card p-6 flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
          <p className="text-sm text-ink-soft">Analyzing file...</p>
        </div>
      )}

      {/* Preview Error */}
      {previewError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">{previewError}</p>
        </motion.div>
      )}

      {/* Preview Results */}
      {preview && !importResult && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-display-thin text-lg text-ink">Preview Summary</h2>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
              Ready to import
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <PreviewStat label="Total Rows" value={preview.totalRows} />
            <PreviewStat label="New Members" value={preview.newMembers} highlight />
            <PreviewStat label="Existing Members" value={preview.existingMembers} />
            <PreviewStat label="Without Email" value={preview.membersWithoutEmail} warn={preview.membersWithoutEmail > 0} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <PreviewStat label="Payment Records" value={preview.paymentRecords} />
          </div>

          {/* Warnings */}
          {preview.warnings && preview.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wider mb-2">
                Warnings
              </p>
              <ul className="space-y-1">
                {preview.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Execute Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium text-ink-soft border border-tan/40 hover:bg-cream transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={executeLoading}
              className="cta-primary text-sm px-6 py-2.5 flex items-center gap-2"
            >
              {executeLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Execute Import
            </button>
          </div>
        </motion.div>
      )}

      {/* Import Result */}
      {importResult && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card p-6 space-y-5"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <h2 className="text-display-thin text-lg text-ink">Import Complete</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <PreviewStat label="Members Created" value={importResult.membersCreated} highlight />
            <PreviewStat label="Members Updated" value={importResult.membersUpdated} />
            <PreviewStat label="Enrollments" value={importResult.enrollmentsCreated} />
            <PreviewStat label="Payments" value={importResult.paymentsRecorded} />
          </div>

          {importResult.errors && importResult.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-medium text-red-700 uppercase tracking-wider mb-2">
                Errors ({importResult.errors.length})
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {err}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-lg text-sm font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Import Another File
            </button>
          </div>
        </motion.div>
      )}

      {/* Import Error */}
      {importError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{importError}</p>
        </motion.div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecuteImport}
        title="Execute Import"
        message={`This will import ${preview?.totalRows || 0} rows, creating ${preview?.newMembers || 0} new members and updating ${preview?.existingMembers || 0} existing members. This action cannot be easily undone.`}
        confirmLabel="Execute Import"
        variant="warning"
      />
    </div>
  );
}

// ===========================================================================
// Export Tab
// ===========================================================================

function ExportTab({ seasonId }: { seasonId: string | null }) {
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetResult, setSheetResult] = useState<GoogleSheetSyncResult | null>(null);

  const [emailFilter, setEmailFilter] = useState('all');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<EmailListResult | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);

  const handleExportSeason = async () => {
    try {
      setExportLoading(true);
      setExportError(null);

      const result = await trpcMutation<{ fileBase64: string; filename: string }>(
        'export.season',
        { seasonId: seasonId || undefined },
      );

      // Decode base64 and trigger download
      const byteCharacters = atob(result.fileBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename || 'season-export.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Export failed. Please try again.',
      );
    } finally {
      setExportLoading(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
    if (!seasonId) {
      setSheetError('Select a season before syncing Google Sheets.');
      return;
    }

    try {
      setSheetLoading(true);
      setSheetError(null);
      setSheetResult(null);

      const result = await trpcMutation<GoogleSheetSyncResult>('export.syncGoogleSheet', {
        seasonId,
      });
      setSheetResult(result);
    } catch (err) {
      setSheetError(
        err instanceof Error ? err.message : 'Google Sheets sync failed.',
      );
    } finally {
      setSheetLoading(false);
    }
  };

  const handleGenerateEmailList = async () => {
    try {
      setEmailLoading(true);
      setEmailError(null);
      setEmailResult(null);

      const result = await trpcQuery<EmailListResult>('export.emailList', {
        seasonId: seasonId || undefined,
        filter: emailFilter,
      });
      setEmailResult(result);
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : 'Failed to generate email list.',
      );
    } finally {
      setEmailLoading(false);
    }
  };

  const handleCopyEmails = async () => {
    if (!emailResult) return;
    try {
      await navigator.clipboard.writeText(emailResult.emailOnly);
      setCopiedEmails(true);
      setTimeout(() => setCopiedEmails(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  const handleCopyCsv = async () => {
    if (!emailResult) return;
    const csv = ['Name,Email', ...emailResult.members.map((m) => `${m.name},${m.email}`)].join(
      '\n',
    );
    try {
      await navigator.clipboard.writeText(csv);
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Season */}
      <div className="luxury-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-display-thin text-lg text-ink">Export Season to Excel</h2>
            <p className="text-body-relaxed text-sm text-ink-soft mt-1">
              Download the complete season data as an Excel spreadsheet.
            </p>
          </div>
          <button
            onClick={handleExportSeason}
            disabled={exportLoading}
            className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
          >
            {exportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportLoading ? 'Exporting...' : 'Export'}
          </button>
        </div>

        {exportError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mt-4"
          >
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">{exportError}</p>
          </motion.div>
        )}
      </div>

      {/* Google Sheets Backup */}
      <div className="luxury-card p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-display-thin text-lg text-ink flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-gold" />
              Sync Google Sheets Backup
            </h2>
            <p className="text-body-relaxed text-sm text-ink-soft mt-1">
              Push the season master-sheet tabs to the configured backup spreadsheet.
            </p>
          </div>
          <button
            onClick={handleSyncGoogleSheet}
            disabled={sheetLoading || !seasonId}
            className="cta-secondary text-sm px-5 py-2.5 flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sheetLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {sheetLoading ? 'Syncing...' : 'Sync Backup'}
          </button>
        </div>

        {sheetError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">{sheetError}</p>
          </motion.div>
        )}

        {sheetResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Synced {sheetResult.memberCount} members and {sheetResult.paymentCount} payments.
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Updated {sheetResult.updatedSheets.map((sheet) => `${sheet.title} (${sheet.rows} rows)`).join(', ')}.
                  </p>
                </div>
              </div>
              <a
                href={sheetResult.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-green-800 hover:text-green-900"
              >
                Open Sheet
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </motion.div>
        )}
      </div>

      {/* Email List Generator */}
      <div className="luxury-card p-6 space-y-5">
        <div>
          <h2 className="text-display-thin text-lg text-ink flex items-center gap-2">
            <Mail className="h-5 w-5 text-gold" />
            Email List Generator
          </h2>
          <p className="text-body-relaxed text-sm text-ink-soft mt-1">
            Generate filtered email lists for communication.
          </p>
        </div>

        {/* Filter + Generate */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="h-4 w-4 text-ink-soft shrink-0" />
            <select
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              className="form-input w-full sm:w-auto min-w-[200px]"
            >
              {emailFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerateEmailList}
            disabled={emailLoading}
            className="cta-primary text-sm px-5 py-2.5 flex items-center gap-2"
          >
            {emailLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            {emailLoading ? 'Generating...' : 'Generate List'}
          </button>
        </div>

        {/* Email Error */}
        {emailError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700">{emailError}</p>
          </motion.div>
        )}

        {/* Email Results */}
        {emailResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Count + Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm text-ink">
                <span className="font-semibold text-ink">{emailResult.count}</span>{' '}
                member{emailResult.count !== 1 ? 's' : ''} found
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyEmails}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
                >
                  {copiedEmails ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedEmails ? 'Copied!' : 'Copy All Emails'}
                </button>
                <button
                  onClick={handleCopyCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-tan/40 text-ink-soft hover:bg-cream transition-colors"
                >
                  {copiedCsv ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedCsv ? 'Copied!' : 'Copy as CSV'}
                </button>
              </div>
            </div>

            {/* Member List */}
            {emailResult.members.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No Members Found"
                description="No members match the selected filter for this season."
              />
            ) : (
              <div className="rounded-xl border border-tan/30 overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-cream/95 backdrop-blur-sm">
                      <tr className="border-b border-sage/10">
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider">
                          Name
                        </th>
                        <th className="text-left py-2.5 px-4 text-xs font-medium text-ink-soft uppercase tracking-wider">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailResult.members.map((member, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-sage/5 hover:bg-sage/[0.03] transition-colors"
                        >
                          <td className="py-2 px-4 text-ink">{member.name}</td>
                          <td className="py-2 px-4 text-ink-soft">{member.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function PreviewStat({
  label,
  value,
  highlight = false,
  warn = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-tan/30 bg-cream/50 p-4">
      <p className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-display-thin text-2xl ${
          warn ? 'text-amber-600' : highlight ? 'text-green-600' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
