import { spawnSync } from 'node:child_process';
import process from 'node:process';

const TASK_BRANCH_PATTERN = /^task\/TASK-\d{8}-\d{3}$/;
const TARGET_BRANCH = 'main';

function usage() {
  console.error(`Usage:
  node scripts/clean-merged-task-branches.mjs [options]

Options:
  --dry-run                 (default) Only report which branches would be deleted
  --force                   Actually delete branches that pass the safety checks
  --branch <name>           Limit operation to a single branch (must match task/TASK-YYYYMMDD-NNN)
  --target <branch>         Compare against a different target branch (default: main)
  --help, -h                Show this help

Safety check (per docs/operations/git-branch-policy.md, "Tree Equivalence"):
  For each task branch:
    1. Find the FIRST commit on <target> whose message contains the branch's [TASK-ID]
       (this is the squash-merge commit; later commits on <target> may have moved past it).
    2. Compare the branch tip's tree object to that commit's tree object.
    3. If trees are identical → the branch's contribution is fully present in <target>;
       branch is safe to delete (with --force).
    4. If trees differ or no matching squash commit exists → keep the branch and report.

  This avoids the false negatives of \`git branch --merged main\` (which only works for
  fast-forward / non-squash merges) and the false positives of plain \`git diff main..<branch>\`
  (which fails when <target> has independent later commits that touch the same files).

Protections:
  - The currently checked-out branch and the target branch are NEVER deleted, regardless of flags.
  - Default mode is dry-run; --force is required for actual deletion.
  - Errors abort that branch only; other branches are still processed.
`);
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    force: false,
    branch: null,
    target: TARGET_BRANCH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
      args.force = false;
    } else if (arg === '--force') {
      args.force = true;
      args.dryRun = false;
    } else if (arg === '--branch') {
      args.branch = argv[++i];
    } else if (arg === '--target') {
      args.target = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (args.branch && !TASK_BRANCH_PATTERN.test(args.branch)) {
    throw new Error(`--branch must match task/TASK-YYYYMMDD-NNN, got: ${args.branch}`);
  }

  return args;
}

function runGit(gitArgs) {
  const result = spawnSync('git', gitArgs, { encoding: 'utf8' });

  if (result.error) {
    throw new Error(`git ${gitArgs.join(' ')} failed to spawn: ${result.error.message}`);
  }

  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function getCurrentBranch() {
  const result = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (result.status !== 0) {
    throw new Error(`Failed to read current branch: ${result.stderr}`);
  }
  return result.stdout;
}

function listLocalBranches() {
  const result = runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads/']);
  if (result.status !== 0) {
    throw new Error(`Failed to list local branches: ${result.stderr}`);
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function targetBranchExists(target) {
  const result = runGit(['rev-parse', '--verify', `refs/heads/${target}`]);
  return result.status === 0;
}

function branchExists(branch) {
  const result = runGit(['rev-parse', '--verify', `refs/heads/${branch}`]);
  return result.status === 0;
}

function treeOf(ref) {
  const result = runGit(['rev-parse', `${ref}^{tree}`]);
  if (result.status !== 0) {
    throw new Error(`Failed to read tree of ${ref}: ${result.stderr}`);
  }
  return result.stdout;
}

function findFirstSquashCommit(taskId, target) {
  // --grep is interpreted as a regex; brackets need escaping.
  const pattern = `\\[${taskId}\\]`;
  const result = runGit(['log', target, '--grep', pattern, '--reverse', '--pretty=format:%H']);
  if (result.status !== 0) {
    throw new Error(`Failed to search ${target} for ${taskId}: ${result.stderr}`);
  }
  if (!result.stdout) return null;
  return result.stdout.split(/\r?\n/)[0];
}

function classifyBranch(branch, target) {
  const taskId = branch.replace(/^task\//, '');
  const squashCommit = findFirstSquashCommit(taskId, target);
  const branchTree = treeOf(branch);

  if (!squashCommit) {
    return {
      verdict: 'keep',
      reason: 'no-squash-commit',
      detail: `No commit on ${target} contains [${taskId}]`,
      branchTree,
      squashCommit: null,
    };
  }

  const squashTree = treeOf(squashCommit);

  if (branchTree === squashTree) {
    return {
      verdict: 'safe-delete',
      reason: 'tree-matches-squash',
      detail: `branch tip tree == ${squashCommit.slice(0, 10)} tree`,
      branchTree,
      squashCommit,
    };
  }

  return {
    verdict: 'keep',
    reason: 'tree-differs-from-squash',
    detail: `branch tip tree ${branchTree.slice(0, 10)} != squash ${squashCommit.slice(0, 10)} tree ${squashTree.slice(0, 10)}`,
    branchTree,
    squashCommit,
  };
}

function deleteBranch(branch) {
  const result = runGit(['branch', '-D', branch]);
  return {
    ok: result.status === 0,
    output: result.stdout || result.stderr,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!targetBranchExists(args.target)) {
    throw new Error(`Target branch does not exist locally: ${args.target}`);
  }

  const current = getCurrentBranch();
  const protectedBranches = new Set([args.target, current]);

  let candidates;
  if (args.branch) {
    if (!branchExists(args.branch)) {
      throw new Error(`Branch does not exist: ${args.branch}`);
    }
    candidates = [args.branch];
  } else {
    candidates = listLocalBranches().filter((b) => TASK_BRANCH_PATTERN.test(b));
  }

  if (candidates.length === 0) {
    console.log(`[clean-branches] no candidate task branches found (target=${args.target}, current=${current})`);
    return;
  }

  console.log(`[clean-branches] mode: ${args.force ? 'FORCE DELETE' : 'dry-run'}`);
  console.log(`[clean-branches] target: ${args.target}`);
  console.log(`[clean-branches] current branch (protected): ${current}`);
  console.log(`[clean-branches] candidates: ${candidates.length}`);
  console.log('');

  const summary = {
    deleted: [],
    skipped_protected: [],
    kept_no_squash: [],
    kept_tree_differs: [],
    skipped_dry_run: [],
    errors: [],
  };

  for (const branch of candidates) {
    if (protectedBranches.has(branch)) {
      console.log(`  [skip:protected]  ${branch}  (current or target)`);
      summary.skipped_protected.push(branch);
      continue;
    }

    let classification;
    try {
      classification = classifyBranch(branch, args.target);
    } catch (error) {
      console.log(`  [error]           ${branch}  ${error.message}`);
      summary.errors.push({ branch, error: error.message });
      continue;
    }

    if (classification.verdict === 'keep') {
      const tag = classification.reason === 'no-squash-commit' ? 'keep:no-squash' : 'keep:tree-diff';
      console.log(`  [${tag}]  ${branch}  ${classification.detail}`);
      if (classification.reason === 'no-squash-commit') {
        summary.kept_no_squash.push(branch);
      } else {
        summary.kept_tree_differs.push(branch);
      }
      continue;
    }

    if (args.dryRun) {
      console.log(`  [would-delete]    ${branch}  ${classification.detail}`);
      summary.skipped_dry_run.push(branch);
      continue;
    }

    const del = deleteBranch(branch);
    if (del.ok) {
      console.log(`  [deleted]         ${branch}  squash=${classification.squashCommit.slice(0, 10)}  ${del.output}`);
      summary.deleted.push({ branch, squash_commit: classification.squashCommit });
    } else {
      console.log(`  [error:delete]    ${branch}  ${del.output}`);
      summary.errors.push({ branch, error: del.output });
    }
  }

  console.log('');
  console.log('[clean-branches] summary:');
  console.log(`  deleted:                 ${summary.deleted.length}`);
  console.log(`  kept (no squash commit): ${summary.kept_no_squash.length}`);
  console.log(`  kept (tree differs):     ${summary.kept_tree_differs.length}`);
  console.log(`  skipped (protected):     ${summary.skipped_protected.length}`);
  console.log(`  skipped (dry-run):       ${summary.skipped_dry_run.length}`);
  console.log(`  errors:                  ${summary.errors.length}`);

  if (summary.errors.length > 0) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[clean-branches] ${error.message}`);
  process.exit(1);
}
