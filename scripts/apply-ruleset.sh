#!/usr/bin/env bash
# Puts the default-branch ruleset on this repository, then prints what is in
# force on main. The rules are the ones every Sigrix public repository carries
# (sigrix-io/actions, docs/new-repository.md), kept in
# docs/default-branch.ruleset.json so a change to them goes through a pull
# request like everything else.
#
# Run it from the repository root, with the GitHub CLI signed in as the owner:
#
#   scripts/apply-ruleset.sh            create the ruleset, then verify
#   scripts/apply-ruleset.sh --verify   only show what is in force
#
# It never creates a second ruleset. Rulesets stack and the stricter rule from
# either one wins, so a second POST is a mistake that is easy to make and slow
# to notice. To change the ruleset once it exists, follow "Change an existing
# ruleset" in sigrix-io/actions, docs/new-repository.md: PUT replaces the whole
# ruleset, so look before you write.
set -euo pipefail

REPO="${REPO:-ftymoshchuk/sotnia}"
RULESET="docs/default-branch.ruleset.json"

verify() {
  echo "== rules in force on main =="
  gh api "repos/$REPO/rules/branches/main" --jq '{
    rulesets:   ([.[].ruleset_id] | unique),
    rules:      ([.[].type] | unique),
    approvals:  [.[] | select(.type=="pull_request") | .parameters.required_approving_review_count],
    checks:     [.[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context],
    up_to_date: [.[] | select(.type=="required_status_checks") | .parameters.strict_required_status_checks_policy]
  }'
  for id in $(gh api "repos/$REPO/rulesets" --jq '.[].id'); do
    gh api "repos/$REPO/rulesets/$id" --jq '{name, enforcement, bypass: [.bypass_actors[]? | "\(.actor_type) \(.actor_id) \(.bypass_mode)"]}'
  done
}

if [ "${1:-}" != "--verify" ]; then
  [ -f "$RULESET" ] || { echo "Run this from the repository root: $RULESET not found." >&2; exit 1; }
  existing=$(gh api "repos/$REPO/rulesets" --jq '.[] | "\(.id)  \(.name)  \(.target)"')
  if [ -n "$existing" ]; then
    echo "$REPO already has a ruleset, so nothing was created:" >&2
    echo "$existing" >&2
    echo "Run with --verify to see it, or change it in place (see the note at the top of this script)." >&2
    exit 1
  fi
  gh api -X POST "repos/$REPO/rulesets" --input "$RULESET" --jq '"Created ruleset \(.id): \(.name), \(.enforcement)"'
fi
verify
