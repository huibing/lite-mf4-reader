<template>
  <div class="progress-bar">
    <div
      class="progress-fill"
      :style="{ width: percent + '%' }"
    ></div>
    <div class="absolute top-0 left-0 text-black flex justify-center w-full"><div class="text-black text-xl">{{ percent.toFixed(2) }}%</div></div>
  </div>
</template>

<script setup>

const props = defineProps({
  percent: {
    type: Number,
    required: true,
    default: 0,
  },
})
</script>

<style scoped>
.progress-bar {
  position: relative;
  width: 90%;
  height: 24px;
  background-color: #eee;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  background-color: #02f73f;
  transition: width 0.3s ease;
}


</style>
