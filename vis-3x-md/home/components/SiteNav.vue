<script setup lang="ts">
/** 门户首页的顶部导航：单行、高度 ≤ 72px */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { REPO_URL, VERSION, docsUrl } from '../site-config'

const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 12
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

/** 导航项。href 用 docsUrl 拼接，开发时指向 5173，生产时用相对路径 */
const links = [
  { text: '指南', href: docsUrl('/guide/introduction') },
  { text: '图表', href: docsUrl('/charts/bar') },
  { text: '自定义', href: docsUrl('/custom/') },
  { text: 'API', href: docsUrl('/api/option') },
  { text: '更新日志', href: docsUrl('/changelog') },
]
</script>

<template>
  <header class="nav" :class="{ 'is-scrolled': scrolled }">
    <div class="nav__inner">
      <a class="nav__brand" href="/">
        <span class="nav__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 18V9l5-3 5 3v9l-5 3z" fill="#4f8cff" />
            <path d="M14 15V7l6-3v8z" fill="#22d3ee" />
          </svg>
        </span>
        <span class="nav__name">vis-3x</span>
      </a>

      <nav class="nav__links">
        <a v-for="l in links" :key="l.href" :href="l.href">{{ l.text }}</a>
      </nav>

      <div class="nav__actions">
        <span class="nav__version">v{{ VERSION }}</span>
        <a
          class="nav__gh"
          :href="REPO_URL"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="GitHub"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
            />
          </svg>
        </a>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 64px;
  border-bottom: 1px solid transparent;
  transition:
    background 0.24s ease,
    border-color 0.24s ease,
    backdrop-filter 0.24s ease;
}

.nav.is-scrolled {
  background: rgba(7, 11, 20, 0.78);
  border-bottom-color: rgba(30, 41, 59, 0.85);
  backdrop-filter: blur(14px);
}

.nav__inner {
  max-width: 1400px;
  height: 100%;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 32px;
}

/* --------------------------------- 品牌 ---------------------------------- */

.nav__brand {
  display: flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  flex: 0 0 auto;
}

.nav__mark {
  width: 26px;
  height: 26px;
  display: block;
}

.nav__mark svg {
  width: 100%;
  height: 100%;
}

.nav__name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #e2e8f0;
}

/* --------------------------------- 链接 ---------------------------------- */

.nav__links {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1 1 auto;
}

.nav__links a {
  font-size: 13.5px;
  font-weight: 500;
  color: #94a3b8;
  text-decoration: none;
  padding: 7px 13px;
  border-radius: 7px;
  transition: all 0.16s ease;
  white-space: nowrap;
}

.nav__links a:hover {
  color: #e2e8f0;
  background: rgba(79, 140, 255, 0.09);
}

/* --------------------------------- 右侧 ---------------------------------- */

.nav__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
}

.nav__version {
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: #64748b;
  padding: 3px 9px;
  border: 1px solid #1e293b;
  border-radius: 999px;
}

.nav__gh {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  color: #94a3b8;
  border-radius: 7px;
  transition: all 0.16s ease;
}

.nav__gh:hover {
  color: #e2e8f0;
  background: rgba(79, 140, 255, 0.09);
}

.nav__gh svg {
  width: 17px;
  height: 17px;
}

@media (max-width: 860px) {
  .nav__links {
    display: none;
  }

  .nav__inner {
    gap: 16px;
  }

  .nav__actions {
    margin-left: auto;
  }
}

@media (max-width: 420px) {
  .nav__version {
    display: none;
  }
}
</style>
