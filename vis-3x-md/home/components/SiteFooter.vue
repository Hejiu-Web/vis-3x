<script setup lang="ts">
/** 门户页脚 */
import { docsUrl } from '../site-config'

const year = new Date().getFullYear()

/** 链接只写文档内的路径，渲染时用 docsUrl 拼上文档站前缀 */
const columns = [
  {
    title: '文档',
    links: [
      { text: '简介', href: '/guide/introduction' },
      { text: '安装', href: '/guide/installation' },
      { text: '快速开始', href: '/guide/quick-start' },
      { text: '配置速查', href: '/guide/cheatsheet' },
    ],
  },
  {
    title: '图表',
    links: [
      { text: '柱状图', href: '/charts/bar' },
      { text: '曲面图', href: '/charts/surface' },
      { text: '饼图', href: '/charts/pie' },
      { text: '仪表盘', href: '/charts/gauge' },
    ],
  },
  {
    title: '扩展',
    links: [
      { text: 'defineChart', href: '/custom/define-chart' },
      { text: 'extendChart', href: '/custom/extend-chart' },
      { text: '渲染上下文', href: '/custom/render-context' },
      { text: '插件系统', href: '/custom/plugins' },
    ],
  },
  {
    title: '参考',
    links: [
      { text: 'API 总览', href: '/api/option' },
      { text: '事件列表', href: '/api/events' },
      { text: '架构', href: '/guide/architecture' },
      { text: '常见问题', href: '/guide/faq' },
    ],
  },
]
</script>

<template>
  <footer class="foot">
    <div class="wrap">
      <div class="foot__top">
        <div class="foot__brand">
          <div class="foot__logo">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 18V9l5-3 5 3v9l-5 3z" fill="#4f8cff" />
              <path d="M14 15V7l6-3v8z" fill="#22d3ee" />
            </svg>
            <span>vis-3x</span>
          </div>
          <p class="foot__tagline">
            基于 Vue 3 + TypeScript + Three.js 的 3D 数据可视化图表库。
          </p>
        </div>

        <div class="foot__cols">
          <div v-for="col in columns" :key="col.title" class="foot__col">
            <h4>{{ col.title }}</h4>
            <ul>
              <li v-for="l in col.links" :key="l.href">
                <a :href="docsUrl(l.href)">{{ l.text }}</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="foot__bottom">
        <span>MIT License · 本项目为独立实现，未复制任何第三方图表库源码</span>
        <span>© {{ year }} vis-3x</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.foot {
  padding: 72px 24px 40px;
  border-top: 1px solid rgba(30, 41, 59, 0.7);
  background: linear-gradient(180deg, transparent, rgba(5, 9, 18, 0.6));
}

.wrap {
  max-width: 1400px;
  margin: 0 auto;
}

.foot__top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 56px;
  padding-bottom: 44px;
}

/* --------------------------------- 品牌 ---------------------------------- */

.foot__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.foot__logo svg {
  width: 26px;
  height: 26px;
}

.foot__logo span {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #e2e8f0;
}

.foot__tagline {
  font-size: 13px;
  line-height: 1.75;
  color: #64748b;
  margin: 0;
  max-width: 34ch;
}

/* --------------------------------- 链接 ---------------------------------- */

.foot__cols {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px;
}

.foot__col h4 {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #7fa8e8;
  margin: 0 0 14px;
}

.foot__col ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.foot__col a {
  font-size: 13px;
  color: #8b9cb3;
  text-decoration: none;
  transition: color 0.16s ease;
}

.foot__col a:hover {
  color: #e2e8f0;
}

/* --------------------------------- 底栏 ---------------------------------- */

.foot__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid rgba(30, 41, 59, 0.6);
  font-size: 12px;
  color: #475569;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .foot__top {
    grid-template-columns: 1fr;
    gap: 36px;
  }

  .foot__cols {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .foot {
    padding: 56px 16px 32px;
  }

  .foot__cols {
    grid-template-columns: 1fr;
    gap: 22px;
  }

  .foot__bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
