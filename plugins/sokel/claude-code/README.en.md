# Claude Code

Connect **Claude Code installed on the local machine** to a workflow: provide a GitLab project and a task. It edits code
in a real worktree, streams progress, and passes its conclusion and list of changes to downstream nodes.

## 1. Deployment prerequisites

This plugin **must run on a machine meeting all three requirements**: access to your GitLab instance (self-hosted instances are often on an internal network),
`claude` installed, and enough disk space for the repository. Like the Kubernetes plugin, it cannot be deployed on just any machine.

## 2. Two configuration locations with distinct responsibilities

**Credentials determine whose usage allowance is charged; the environment determines what this machine can do.**

The credential has only one field:

| Field | What to enter |
|---|---|
| Anthropic API Key | **May be empty**. Empty uses Claude Code's own login state on that machine, common with subscriptions. Providing a key charges this invocation to that key, useful for accounting across workspaces and auditing. Both deployment models are valid. |

Everything else is a **deployment environment variable**. Workflow authors should not need to configure these:

| Environment variable | Purpose |
|---|---|
| `SOKEL_CC_GIT_BASE` | GitLab root URL, such as `https://git.example.com`. |
| `SOKEL_CC_GIT_TOKEN` | Clone/push token. **If unset, git uses its own authentication on the machine** (credential helper, `.netrc`, or SSH), keeping the token out of the plugin process entirely. |
| `SOKEL_CC_WORKSPACE` | Storage location for repositories and worktrees; defaults to a location under the system temporary directory. |
| `SOKEL_CC_CLAUDE_BIN` | Path to `claude`; defaults to searching PATH. |
| `SOKEL_CC_ALLOW_EXTERNAL_DIRS=1` | Allows Continue task to specify a directory outside the workspace; disabled by default. |
| `http_proxy` / `https_proxy` | Claude Code's outbound proxy. **Claude Code reads these standard variables itself**; the plugin does not forward them. They are actively removed for git so internal repositories do not go through a proxy. |

**Why this separation exists**: the GitLab URL and token used to be credential fields, requiring duplicate configuration in both this plugin and the GitLab plugin.
Token rotation could easily miss one copy, and moving machines required changing the credential. More importantly, **workflow authors** select credentials
on the canvas, while **operators** should control which directories the machine can access and which proxy it uses.

After configuration, click Check credentials to see the Claude Code version, workspace, and GitLab connectivity.

## 3. Typical usage

Connect two nodes:

```
[Claude Code · Run task] ──→ [GitLab · Create MR]
```

Claude Code edits code and pushes a branch; the GitLab plugin opens the MR. Each handles its own stage, making failures easier to locate.

**Make the task specific and include acceptance criteria**:

> Fix the out-of-range alert pagination issue in `internal/api` and make `go test ./internal/api` pass.

This is much more useful than “Fix pagination”: it prompts Claude Code to verify the change with tests.

To follow up after a run, such as “The tests failed; try again,” use **Continue task**. Pass the output `session_id` and
`branch`; Claude Code remembers the previous round and continues in the same worktree.

## 4. Visible progress

Task operations stream output. Claude Code sends text as it works, and the canvas run panel grows during execution.
The complete output is also available in the `log` output after completion. A ten-minute task should show more than “Running.”

## 5. Take over an existing session manually

If you want to take over while a workflow is running, because it is heading in the wrong direction or you want to guide it:

```bash
cd <worktree from the output>
claude --resume <session_id from the output>
```

**All three conditions are required**:

1. **The same machine**: the session is stored at `~/.claude/projects/<escaped-working-directory>/<session-id>.jsonl`
   on the plugin's machine. It does not travel over the network.
2. **The same operating-system user**: session files use permissions `0600`, so only the user that ran the session can read them.
   If the plugin uses a dedicated service account, as recommended, log in as that account to take over.
3. **The session still exists**: unless `--no-session-persistence` was enabled, which it is not by default, the file remains.

You can hand the session back to the workflow afterward. **The session ID remains unchanged** unless you fork it with `--fork-session`.
Pass the same ID to Continue task next time. It uses the same worktree and sees your manual edits.

### The reverse: let the plugin take over a session you started

This also works and is **the more common direction**. After working with Claude Code in a terminal, you may want a workflow
to handle the next steps: run tests, make another change, and send a notification.

1. Set `SOKEL_CC_ALLOW_EXTERNAL_DIRS=1` when deploying the machine; this is disabled by default, as explained below.
2. In Continue task, provide the **session ID** and **direct working-directory override** (your repository's absolute path).
   Leave project and branch empty.

Claude Code finds sessions by ID across the machine, regardless of the directory where they started.

**Why this requires a switch**: the input lets a workflow author point Claude Code at **any** directory on that machine,
extending its reach from the plugin workspace to the whole machine. The control belongs in the **deployment environment**,
not the operation input: operators deploy the machine, while business users build workflows. Operators should decide which directories those users can target.

**Pushing is not supported for external directories**. You control that repository's remote and branch; the plugin should not guess where to push.
Changes stay in the directory, and you run `git push` yourself.

> After each Run task operation, the final log line contains a ready-to-copy takeover command.

## 6. Using the outputs

| Output | Purpose |
|---|---|
| `conclusion` | Claude Code's final response: what it did and the result. Display it to a person or pass it to a downstream LLM. |
| `changed_files` / `diff` | What changed. Use a condition node to check whether any changes were made. |
| `branch` / `pushed` | Inputs for creating an MR with the GitLab plugin. |
| `cost_usd` / `turns` | Usage for this run; useful for alerts and statistics. |
| `session_id` | Input to Continue task and the `--resume` argument for manual takeover. |
| `worktree` | Directory containing the code changes. Change into it to take over manually. |
| `denied_tools` | **Check this first when a task is unfinished**. A nonempty value means actions were blocked by permissions, which may be too restrictive. |

## 7. Manage local worktrees and sessions

Worktrees and sessions accumulate over time. Use these operations to inspect and clean them:

**List worktrees**: inspect before deleting. Each entry includes project, branch, path, size in MB, last activity, idle days,
**whether there are uncommitted changes**, session count, and the most recent session ID, ready for `claude --resume`.

**Clean worktrees** supports two modes:

- Delete a named worktree: provide project and branch.
- Batch cleanup: provide `idle_days`, such as 14, optionally restricting it to a `project`.

Three safeguards apply:

1. **A request with neither a branch nor idle days is rejected**; deleting all worktrees requires an explicit choice.
2. **Worktrees with uncommitted changes are protected by default**, with `include_dirty` off. Deletion is permanent.
3. Use `dry_run` first to preview what would be deleted.

**Sessions are not deleted**. Claude Code owns its session storage under `~/.claude/projects/`; this plugin only reclaims the code directories.
Session files are small. If you need to remove them, do so manually, avoiding accidental deletion of other sessions you started on the same machine.

## 8. Common pitfalls

- **Code is not pushed by default**. The operation returns a diff and conclusion, leaving code in the worktree. Enable pushing explicitly;
  giving an agent push access by default can have consequences that become apparent only after something goes wrong.
- **Always set a cost limit**. `max_budget_usd` is the only brake if the agent runs out of control. Without it,
  the bill may be your first indication of the problem.
- **Permission mode** defaults to `acceptEdits`, allowing file edits and routine file commands.
  `bypassPermissions` hands over the machine; use it only in an isolated container.
- **The same branch name reuses the same worktree**. A second run is faster, but it sees previous changes. For a clean start,
  use another branch name or run Clean worktrees first.
- **Tool filters use colon syntax**: `Bash(git:*)`, not `Bash(git *)`.
- **Run only one task per branch at a time**. Two tasks sharing a worktree will interfere with each other.
