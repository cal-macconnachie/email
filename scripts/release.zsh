#!/usr/bin/env zsh
#  export .env.local variables as environment variables
set -a
source .env.local
set +a

# run terraform fmt to lint terraform files
echo "Running linter..."
yarn lint

# if tree is dirty after linting, abort
if [[ -n $(git status --porcelain) ]]; then
  read "?Linting changes detected. Please review and input 'y' to continue, press any other key to abort: " response
  if [[ "$response" != "y" ]]; then
    echo "Release cancelled."
    exit 1
  fi
  git add .
  git commit -m "chore: lint terraform files"
fi

# build lambda files
echo "Building lambda files..."
yarn build

# run terraform validate to validate terraform files
echo "Validating terraform files..."
terraform validate

# run terraform plan to check for changes
# -detailed-exitcode: Returns 0 if no changes, 2 if changes exist, 1 if error
echo "Running terraform plan..."
terraform plan -detailed-exitcode
PLAN_EXIT_CODE=$?

# check if there are changes
if [[ $PLAN_EXIT_CODE -eq 2 ]]; then
  # changes detected, ask for approval
  echo "\nChanges detected in terraform plan."
  read "?Do you want to proceed with the release? (y/n) " response
  if [[ "$response" != "y" ]]; then
    echo "Release cancelled."
    exit 1
  fi
elif [[ $PLAN_EXIT_CODE -eq 1 ]]; then
  # error occurred
  echo "Error running terraform plan. Aborting release."
  exit 1
else
  # no changes, proceed automatically
  echo "No infrastructure changes detected. Proceeding with release..."
fi

# run standard-version for release tagging
echo "Creating release tag..."
yarn standard-version

echo "\nRelease tag created successfully!"
git push --follow-tags origin main

# remove dist folder
echo "Cleaning up build artifacts..."
rm -rf dist

# done
echo "Release process completed."
