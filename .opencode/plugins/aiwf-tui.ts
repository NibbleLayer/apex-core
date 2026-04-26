import type { Plugin } from "@opencode-ai/plugin"

type AiwfBootstrap = {
  status?: string
  headline?: string
  progress?: { percentage?: number }
}

type AiwfWorkSummary = {
  id?: string
  title?: string
  state?: string
  tier?: string
  labels?: string[]
  created_at?: string
  updated_at?: string
}

type AiwfNextAction = {
  command?: string
  summary?: string
}

type AiwfUnifiedStatus = {
  bootstrap?: AiwfBootstrap
  active_work?: AiwfWorkSummary[]
  stats?: {
    total?: number
    active_count?: number
    settled_count?: number
    abandoned_count?: number
    by_state?: Record<string, number>
    by_tier?: Record<string, number>
    labels?: Record<string, number>
  }
  recent_transitions?: Array<{
    work_id?: string
    work_title?: string
    from?: string
    to?: string
    at?: string
    reason?: string
  }>
  next_action?: AiwfNextAction
}

type ToastVariant = "info" | "warning" | "success" | "error"

type ToastPayload = {
  message: string
  variant: ToastVariant
}

const CACHE_TTL_MS = 2000
const READY_SEQUENCE = "aiwf status -> aiwf new <description> -> aiwf check"

const commandOutput = (value: unknown): string => {
  if (typeof value === "string") {
    return value
  }
  if (value && typeof value === "object" && "stdout" in value) {
    const stdout = (value as { stdout?: unknown }).stdout
    if (typeof stdout === "string") {
      return stdout
    }
  }
  return ""
}

const activeWork = (status: AiwfUnifiedStatus | null): AiwfWorkSummary[] => status?.active_work || []

const primaryWork = (status: AiwfUnifiedStatus | null): AiwfWorkSummary | undefined => activeWork(status)[0]

const actionLabel = (next?: AiwfNextAction): string => next?.command || "aiwf status"

const actionSummary = (next?: AiwfNextAction): string => next?.summary || "Review current status"

export const AIWFTuiPlugin: Plugin = async ({ $, client, directory }) => {
  let cachedStatus: AiwfUnifiedStatus | null = null
  let cachedAt = 0
  let lastPromptSignature = ""
  let lastToastSignature = ""
  let lastGuidanceSignature = ""

  const readStatus = async (force = false): Promise<AiwfUnifiedStatus | null> => {
    const now = Date.now()
    if (!force && cachedStatus && now - cachedAt < CACHE_TTL_MS) {
      return cachedStatus
    }

    try {
      const result = await $`aiwf status --json`.cwd(directory).quiet()
      const stdout = commandOutput(result).trim()
      if (!stdout) {
        return cachedStatus
      }
      cachedStatus = JSON.parse(stdout) as AiwfUnifiedStatus
      cachedAt = now
      return cachedStatus
    } catch (error) {
      await client.app.log({
        body: {
          service: "aiwf-tui",
          level: "warn",
          message: "Failed to read AIWF status",
          extra: {
            directory,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      })
      return cachedStatus
    }
  }

  const renderPrompt = (status: AiwfUnifiedStatus | null): string | null => {
    if (!status) return null

    const bootstrapStatus = status.bootstrap?.status || "unknown"
    const work = primaryWork(status)
    const activeCount = activeWork(status).length
    const next = status.next_action

    if (bootstrapStatus !== "complete" && activeCount === 0) {
      const progress = status.bootstrap?.progress?.percentage ?? 0
      return `[AIWF] bootstrap=${bootstrapStatus} progress=${progress}% next=${actionLabel(next)} — ${actionSummary(next)}`
    }

    if (activeCount === 1 && work?.id) {
      return `[AIWF] work=${work.id}|${work.state || "unknown"}|${work.tier || ""} next=${actionLabel(next)} — ${actionSummary(next)}`
    }

    if (activeCount > 1) {
      return `[AIWF] active_work=${activeCount} next=${actionLabel(next)} — ${actionSummary(next)}`
    }

    return `[AIWF] ready next=${actionLabel(next)} start=${READY_SEQUENCE}`
  }

  const renderToast = (status: AiwfUnifiedStatus | null): ToastPayload | null => {
    if (!status) return null

    const bootstrapStatus = status.bootstrap?.status
    const work = primaryWork(status)
    const activeCount = activeWork(status).length
    const next = status.next_action

    if (bootstrapStatus && bootstrapStatus !== "complete" && activeCount === 0) {
      return {
        message: `${status.bootstrap?.headline || "Bootstrap incomplete"} — Next: ${actionLabel(next)}`,
        variant: bootstrapStatus === "unbootstrapped" ? "warning" : "info",
      }
    }

    if (activeCount > 1) {
      return {
        message: `Multiple active work items detected (${activeCount}) — Next: ${actionLabel(next)}`,
        variant: "warning",
      }
    }

    if (work?.id && work.state === "verified") {
      return {
        message: `Work ${work.id} is verified — ${actionLabel(next)}`,
        variant: "success",
      }
    }

    if (bootstrapStatus === "complete" && activeCount === 0) {
      return {
        message: "No active work — Start with aiwf new <description>",
        variant: "info",
      }
    }

    return null
  }

  const renderGuidanceToast = (status: AiwfUnifiedStatus | null): string | null => {
    if (!status) return null

    const bootstrapStatus = status.bootstrap?.status
    const work = primaryWork(status)
    const activeCount = activeWork(status).length
    const next = status.next_action

    if (bootstrapStatus && bootstrapStatus !== "complete" && activeCount === 0) {
      const progress = status.bootstrap?.progress?.percentage ?? 0
      return `AIWF bootstrap ${bootstrapStatus} (${progress}%). Run ${actionLabel(next)} to continue.`
    }

    if (activeCount > 1) {
      return [
        `Active work items: ${activeCount}`,
        `Next: ${actionLabel(next)} — ${actionSummary(next)}`,
      ].join("\n")
    }

    if (work?.id) {
      return [
        `Work: ${work.id} | ${work.state || "unknown"} | ${work.tier || "unknown tier"}`,
        work.title ? `Title: ${work.title}` : "",
        `Next: ${actionLabel(next)} — ${actionSummary(next)}`,
      ].filter(Boolean).join("\n")
    }

    if (bootstrapStatus === "complete") {
      return `AIWF ready. Start: ${READY_SEQUENCE}`
    }

    return null
  }

  const maybeAppendPrompt = async (status: AiwfUnifiedStatus | null): Promise<void> => {
    const prompt = renderPrompt(status)
    if (!prompt || prompt === lastPromptSignature) return
    lastPromptSignature = prompt
    await client.tui.appendPrompt({ body: { text: prompt } })
  }

  const maybeShowToast = async (status: AiwfUnifiedStatus | null): Promise<void> => {
    const toast = renderToast(status)
    if (!toast) return
    const signature = `${toast.variant}:${toast.message}`
    if (signature === lastToastSignature) return
    lastToastSignature = signature
    await client.tui.showToast({ body: { message: toast.message, variant: toast.variant } })
  }

  const maybeShowGuidance = async (status: AiwfUnifiedStatus | null): Promise<void> => {
    const toast = renderGuidanceToast(status)
    if (!toast || toast === lastGuidanceSignature) return
    lastGuidanceSignature = toast
    await client.tui.showToast({ body: { message: toast, variant: "warning" } })
  }

  return {
    "shell.env": async (_input, output) => {
      const status = await readStatus()
      const work = primaryWork(status)
      const activeCount = activeWork(status).length

      output.env.AIWF_PROJECT_ROOT = directory
      output.env.AIWF_BOOTSTRAP_STATUS = status?.bootstrap?.status || ""
      output.env.AIWF_BOOTSTRAP_HEADLINE = status?.bootstrap?.headline || ""
      output.env.AIWF_ACTIVE_WORK_COUNT = String(activeCount)
      output.env.AIWF_WORK_ID = work?.id || ""
      output.env.AIWF_WORK_STATE = work?.state || ""
      output.env.AIWF_WORK_TITLE = work?.title || ""
      output.env.AIWF_WORK_TIER = work?.tier || ""
      output.env.AIWF_NEXT_ACTION = status?.next_action?.command || ""
      output.env.AIWF_NEXT_ACTION_SUMMARY = status?.next_action?.summary || ""
    },
    "tool.execute.after": async (input) => {
      if (input.tool === "bash") {
        await readStatus(true)
      }
    },
    event: async ({ event }) => {
      if (event.type === "session.created" || event.type === "session.updated") {
        const status = await readStatus(true)
        await maybeAppendPrompt(status)
        await maybeShowToast(status)
        await maybeShowGuidance(status)
        return
      }
      if (event.type === "command.executed") {
        const status = await readStatus(true)
        await maybeShowToast(status)
        await maybeShowGuidance(status)
      }
    },
  }
}
