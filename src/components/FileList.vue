<template>
<div class="flex flex-col w-full p-1 items-center justify-center"  v-if="fileList.length>0">
  <div v-for="(file, index) in fileList" class="flex justify-between m-1 items-center w-full h-10 rounded-sm
               hover:bg-purple-300 shadow-md hover:shadow-xl " >
    <span class="text-lg rounded-xl" > [{{ index + 1 }}] </span>  
    <span @mousedown="(e)=>handleClick(e, file)" class="text-sm w-1/2 font-bold whitespace-nowrap overflow-hidden" :title=file > {{ getFileName(file) }} </span> 
    <div class="flex items-center">
      <span @click="handleReplace(file)" class="opacity-30 hover:cursor-pointer hover:opacity-80 hover:-translate-y-0.5"> 
        <font-awesome-icon icon="fa-solid fa-arrows-spin" size="sm" style="color: #000000;"/>
      </span>
      <svg class="w-5 h-5 text-gray-600 hover:text-red-500 cursor-pointer" viewBox="0 0 24 24" fill="none" @click="handleDelete(index, file)">
          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2" />
          <line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" stroke-width="2" />
      </svg>
    </div>
  </div>
</div>
</template>

<script setup>
import { open } from '@tauri-apps/plugin-dialog'
const fileList = defineModel();
const emit = defineEmits(["delete-file", "add-file"]);

const handleDelete = (index, file) => {
    fileList.value.splice(index, 1);
    emit("delete-file", file);
}
const getFileName = (file) => {
  return file.split('\\').pop().split('/').pop();
}

const handleClick = (event, file) => {
  event.preventDefault();
  if (event.button== 2) {
    navigator.clipboard.writeText(file)
    .then(() => {
      alert('已复制文件路径到剪贴板：' + file);
    })
    .catch(err => {
      alert('复制失败: ' + err);
    });
  }
}

const handleReplace = (file) => {
  if (fileList.value.includes(file)) {
    open({
      multiple: false,
      filters: [{
        name: 'mf4 file',
        extensions: ['mf4', 'MF4']
      }]
    }).then((selFile) => {
      if (selFile) {
        fileList.value.splice(fileList.value.indexOf(file), 1, selFile);   // 替换原有文件
        emit("delete-file", file);
        emit("add-file", selFile);
      }
    }).catch((err) => {
      console.error(err);
    });
  }
}

</script>