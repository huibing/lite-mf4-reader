<template>
  <div class="flex items-center border-1 border-gray-200 my-4 pl-1">
    <div><font-awesome-icon icon="fa-solid fa-magnifying-glass" size="sm" style="color: #d9cef3;" /></div>
    <input class="focus:outline-1 w-full" type="text" placeholder="请输入变量名" @input="handleInput" />
  </div>
  <div v-if="lines.length>0" class="multi-line-selectable">
    <div
      v-for="(line, index) in lines"
      :key="index"
      class="line flex justify-between overflow-x-hidden"
      :title="line[0]"
      :class="{ selected: isSelected(line) }"
      @click="toggleSelection(line)"
      draggable="true"
      @dragstart="handleDragStart"
    >
      <span class="w-3/4 text-left overflow-hidden">{{ line[0] }}</span> <span :title="line[1]">|[{{ getFileIndex(line[1]) }}]</span>
    </div>
  
  </div>
  <div class="flex justify-end w-full opacity-60" v-if="lines.length > 0"><span class="pr-4 text-xs">Total of {{ lines.length }} variables</span></div>
  <div class="flex justify-end w-full opacity-80" v-if="selectedLines.length > 0">
    <span class="pr-4 text-xs text-blue-900 font-black">Selected {{ selectedLines.length }} variables</span></div>
  <div class="flex h-full items-end justify-center">
    <button class="btn text-purple-800" @click="selectedLines=[]">清空选中行</button></div>
  
</template>

<script setup>
import { ref, onMounted , watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 接收父级传入的内容
const props = defineProps({
  content: {
    type: Array,
    required: true
  },
  fileList: {
    type: Array,
    required: true
  }
});
const emit = defineEmits(['value-pre-read']);
const lines = ref([]);
onMounted(() => {
  lines.value = props.content;
});

// 本地存储选中行
const selectedLines = defineModel();

function toggleSelection(line) {
  const index = selectedLines.value.indexOf(line);
  if (index >= 0) {
    selectedLines.value.splice(index, 1)
  } else {
    selectedLines.value.push(line)
  }
}

function isSelected(line) {
  return selectedLines.value.includes(line)
}

function handleDragStart(event) {
  const payload = selectedLines.value.length > 0
    ? selectedLines.value : [];
  const payloadString = payload.map(line => [line[0], line[1]]);
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData('application/json', JSON.stringify(payloadString));
  payload.forEach(variable => {
    invoke("get_mf4_channel_data", {"mf4Path": variable[1], "channelName": variable[0]})   // start to read data from mf4 file when drag start
            .then(res => {
              emit('value-pre-read', res, variable[0], variable[1]);
            }).catch(err => {
              console.error(err);}) 
  });
}

const handleInput = (event) => {
  const stringInput = event.target.value + '*';
  const newLines = props.content.filter(line => {
    return matchWildcard(line, stringInput)
  }
  )
  lines.value = newLines;
}

function matchWildcard(str, pattern) {
  const regex = new RegExp('^' + pattern.split('*').map(s => s.replace(/[-[\]{}()+?.\\^$|]/g, '\\$&')).join('.*') + '$', 'i');
  return regex.test(str);
}

const getFileName = (file) => {
  return file.split('\\').pop().split('/').pop()
}

const getFileIndex = (file) => {
  const fileName = getFileName(file);
  return props.fileList.findIndex(f => getFileName(f) === fileName) + 1;
}

watch(() => props.content, () => {
  lines.value = props.content;
}, { deep: true });
</script>

<style scoped>
.multi-line-selectable {
  border: 2px solid #1d1a1a;
  max-height: 600px; /* 固定高度 */
  overflow-y: auto;  /* 超出时出现滚动条 */
}

.line {
  padding: 6px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.5s;
}

.line:hover {
  background-color: #95ba5e;
}

.line.selected {
  background-color: #007bff;
  color: white;
}

.btn {
  margin-bottom: 10px;
  border-radius: 1em;
  font-size: 1em;
  background-color: #96c4ff;
}

.btn:hover {
  background-color: #ffffffa4;
  border-color: #ffffff;
}

.btn:active {
  transform: translate(0, 2px);
}
</style>
