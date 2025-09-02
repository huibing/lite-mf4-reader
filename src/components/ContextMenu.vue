<template>
  <ul
    v-if="visible"
    class="absolute bg-white shadow-lg rounded-md border py-2 w-50 z-50 opacity-85"
    :style="{ top: y + 'px', left: x + 'px' }"
  >
    <li
      v-for="(item, i) in items"
      :key="item.label"
      class="flex px-4 py-2 hover:bg-blue-500 cursor-pointer justify-between w-full"
      :class="bgColor(i)"
      @click="handleClick(item)"
      :title="item.label"
    >
      <span class="text-xs">{{ item.label }}</span> <span class="text-xs"> {{ item.shortCut }} </span>
    </li>
  </ul>
</template>

<script setup>
import { ref } from "vue"

const props = defineProps({
  items: { type: Array, required: true },   // [{label, action}]
})

const emit = defineEmits(["select"])  // 让父组件接收点击事件

const visible = ref(false)
const x = ref(0)
const y = ref(0)

function open(e) {
  x.value = e.clientX
  y.value = e.clientY
  visible.value = true
}

function close() {
  visible.value = false
}

function handleClick(item) {
  emit("select", item)   // 把点击的菜单项传给父组件
  close()
}

const bgColor = (index) => {
  if (index % 2 === 1) {
    return "bg-gray-100"
  }
  return "bg-white"
}

defineExpose({ open, close })   // 让父组件能调用 open/close
</script>
