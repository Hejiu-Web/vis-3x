<script setup lang="ts">
/**
 * vis-3x 门户首页
 *
 * 结构：
 * 1. HeroSection  — 可交互 3D 图表舞台
 * 2. FeatureGrid  — bento 特性区
 * 3. ChartShowcase— 真实图表总览
 * 4. QuickStart   — 四种用法的代码示例
 * 5. SiteFooter
 */
import SiteNav from './components/SiteNav.vue'
import HeroSection from './components/HeroSection.vue'
import FeatureGrid from './components/FeatureGrid.vue'
import ChartShowcase from './components/ChartShowcase.vue'
import QuickStart from './components/QuickStart.vue'
import SiteFooter from './components/SiteFooter.vue'
</script>

<template>
  <SiteNav />
  <main>
    <HeroSection />
    <FeatureGrid />
    <ChartShowcase />
    <QuickStart />
  </main>
  <SiteFooter />
</template>
