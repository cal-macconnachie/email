<template>
  <div class="install-instructions-container">
    <base-card
      variant="elevated"
      padding="lg"
      class="install-card"
    >
      <div class="instructions-content">
        <h1 class="title">Install This App</h1>
        <p class="subtitle">
          To use this app, please install it on your home screen.
        </p>

        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <p class="step-text">
                Tap the <strong>Share</strong> button
              </p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <p class="step-text">
                Scroll down and tap
                <strong>"Add to Home Screen"</strong>
              </p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <p class="step-text">
                Tap <strong>"Add"</strong> in the top right corner
              </p>
            </div>
          </div>

          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <p class="step-text">
                Open the app from your home screen to get started
              </p>
            </div>
          </div>
        </div>

        <div class="help-text">
          <p>Once installed, you'll be able to log in and use the app.</p>
        </div>
      </div>
    </base-card>
  </div>
</template>

<script setup lang="ts">
// This page only shows for iOS Safari users who haven't installed the PWA yet
</script>

<style scoped>
.install-instructions-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--color-bg-secondary);
  padding: var(--space-4);
}

.install-card {
  width: 100%;
  max-width: 500px;
}

.instructions-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.title {
  margin: 0;
  font-size: var(--font-size-3xl);
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: center;
}

.subtitle {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.5;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  margin-top: var(--space-2);
}

.step {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.step-number {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background-color: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--font-size-lg);
}

.step-content {
  flex: 1;
  padding-top: 4px;
}

.step-text {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: 1.6;
}

.share-icon {
  display: inline-block;
  font-size: var(--font-size-xl);
  vertical-align: middle;
  margin: 0 2px;
  font-weight: bold;
}

.help-text {
  margin-top: var(--space-2);
  padding: var(--space-4);
  background-color: var(--color-bg-muted);
  border-radius: var(--radius-md);
  text-align: center;
}

.help-text p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

@media (max-width: 480px) {
  .install-instructions-container {
    padding: var(--space-2);
  }

  .title {
    font-size: var(--font-size-2xl);
  }

  .subtitle {
    font-size: var(--font-size-base);
  }
}
</style>
