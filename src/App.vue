<script setup>
import MultiLinePlot from './components/MultiLinePlot.vue';
import ProgressBar from './components/ProgressBar.vue';
import SelectVars from './components/SelectVars.vue';
import FileList from './components/FileList.vue';
import YResizeable from './components/YResizeable.vue';
import FancyButton from './components/FancyButton.vue';
import PlotView from './components/PlotView.vue';

import { onMounted , ref , Transition, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog'
import { listen } from '@tauri-apps/api/event'
import { generateColorWheelColors } from './utility.js';
import * as d3 from 'd3';

const colorPalette = generateColorWheelColors(7);
let colorIndex = 0;
const lineData = ref({"test": {"data": {x: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], y: [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100]}, "stroke": 1.5, 
        "color": colorPalette[colorIndex++ % colorPalette.length], "circle": false, "file": "D:\\dummyfile.mf4", "x_domain": [0, 10], "y_domain": [0, 100]}}); // 初始化数据

const updateInprogress = ref(false);   // tell the graph not to draw while we are updating
let dispProgress = ref(false);
let progress = ref(0);
let varList = ref([]);
let selectedLines = ref([]);
const fileList = ref(Array());
let fileView = ref(true);
let varView = ref(false);
const plotView = ref(false);   // 需要一个更好的变量名称
let showPanel = ref(true);
let transitionName = ref('fold');

const readFile = (file) => {
  if (file) {
    dispProgress.value = true;
    listen("progress-message", (event) => {
      progress.value = event.payload;
    })
    invoke("get_mf4_channels", {"mf4Path": file}).then(res => {
    const newvarListWithFile = res.map( (item) => [item, file]);   // [varname, filePath]
    varList.value.push(...newvarListWithFile);
    dispProgress.value = false;
    selectedLines.value = []; // 清空选中行
  }).catch(err => {
    console.error("Error invoking get_mf4_channels:", err);
    dispProgress.value = false;
  });
  }
}

const pickFile = async (e) => {
  const file = await open({
  multiple: false,
  directory: false,
  filters: [{
    name: 'mf4 file',
    extensions: ['mf4', 'MF4']
  }],
});
  fileList.value.push(file);
}

function handleDrop(event) { // read mf4 channel data and feed to LinePlot's data
  event.preventDefault();
  const data = event.dataTransfer.getData('application/json');
  if (data) {
    const value = JSON.parse(data);
    updateInprogress.value = true;    // 开始更新数据，子组件停止更新画布
    value.forEach( variable => {
      if (variable[0] in lineData.value) return;
      console.time("get_mf4_channel_data");
      invoke("get_mf4_channel_data", {"mf4Path": variable[1], "channelName": variable[0]}).then(res => {
        const [data, time] = res;
        const x_domain = [time[0], time[time.length - 1]];
        const y_domain = d3.extent(data);
        lineData.value[variable[0]] = {"data": {x: time, y: data}, 
                                      "color": colorPalette[colorIndex++ % colorPalette.length], 
                                      "stroke": 1.5, "circle": false, "x_domain": x_domain, "y_domain": y_domain,
                                      "file": variable[1]};
        console.timeEnd("get_mf4_channel_data");
      })
    })
    updateInprogress.value = false;  // 更新完成 子组件可以更新画布
  }
}
const handleDragOver = (event) => {
  event.preventDefault(); // 阻止默认行为以允许 drop 事件
  event.dataTransfer.dropEffect = "copy";
}

onMounted(() => {
  
})

watch(() => fileList.value, () => {
  varList.value = varList.value.filter( (item) => fileList.value.includes(item[1]));
  updateInprogress.value = true; // 通知子组件停止更新画布
  for (const variable in lineData.value) {
    if (!fileList.value.includes(lineData.value[variable].file) && variable !== "test") {
      delete lineData.value[variable];
    }
  }
  updateInprogress.value = false;
  // all files should be read again in case new file are added in FileList.vue
  fileList.value.map((file)=> readFile(file));
}, { deep: true });

const switchView = (viewComponent) => {
  const allViews = {"fileView": fileView, "varView": varView, "plotView": plotView};
  let viewValue = allViews[viewComponent];
  if (viewValue.value){
    viewValue.value = false;
    showPanel.value = false;
    transitionName.value = 'fold';
  } else {
    viewValue.value = true;
    Object.keys(allViews).map((key) => {
      if (key !== viewComponent) {
        allViews[key].value = false;
      }
    });
  }
};

const switchPanelview = () => {
  const allViews = [fileView, varView, plotView]; 
  if (showPanel.value){
    allViews.map((view) => view.value = false); // 关闭所有面板
    showPanel.value = false;
    transitionName.value = 'fold';
  } else {
    allViews[0].value = true; // 打开第一个面板
    showPanel.value = true;
    transitionName.value = 'unfold';
  }
}
</script>

<template>
  <div class="flex">
    <Transition mode="out-in" :name="transitionName">
    <div v-if="showPanel" class="flex h-auto border-1">
        <div class="flex flex-col justify-between w-10 border-r-2 ">
          <div class="flex flex-col gap-4 justify-start items-center">
            <div @click="switchView('fileView')" tabindex="1" class="hover:cursor-pointer hover:border-1 hover:border-blue-500 focus:border-l-2" title="Files"> 
              <font-awesome-icon icon="fa-solid fa-file" style="color:#B197FC" size="lg"  /> </div>
            <div @click="switchView('varView')" tabindex="1" class="hover:cursor-pointer hover:border-1 hover:border-blue-500 focus:border-l-2" title="Variables"> 
              <font-awesome-icon icon="fa-solid fa-bars" size="lg" style="color: #95ba5e;" /> </div>
            <div @click="switchView('plotView')" tabindex="1" class="hover:cursor-pointer hover:border-1 hover:border-blue-500 focus:border-l-2" title="GraphConfig"> 
              <font-awesome-icon icon="fa-solid fa-layer-group" size="lg" style="color: #f33939;" /> </div>
          </div>
          <div @click="switchPanelview" tabindex="1" class="hover:cursor-pointer hover:border-1 hover:border-blue-500 focus:border-l-2 mb-6" title="Collapse Panel"> 
              <font-awesome-icon icon="fa-solid fa-angles-left" size="lg" style="color: #FFD43B;" /> </div>
        </div>
    <YResizeable :minWidth="200" >
      <div class="flex shadow-lg rounded-b-2xl hover:-translate-y-0.5 w-full"><!-- 左侧面板 -->
        <div v-if="fileView" class="file flex flex-col items-center w-full">
          <div class="flex justify-start w-full border-b-1 mb-2"><div class="p-1 text-indigo-700 font-bold">Files</div></div>
            <FancyButton title="Add a mf4 file" :onClick="pickFile" class="w-30 h-10 flex justify-between m-1">
              <div class="flex items-center justify-between w-full"><span class="text-gray-500 font-bold text-lg pl-2 hover:cursor-pointer group-hover:text-blue-500">+</span>
                <span class="text-xs group-hover:text-blue-500 pr-2 font-extrabold">MF4</span></div> </FancyButton>
          <ProgressBar v-if="dispProgress" :percent=progress />
          <FileList v-model="fileList" />
        </div>
        <div v-if="varView" class="flex flex-col w-full">
          <SelectVars  v-model="selectedLines" :content="varList" :fileList="fileList" />
        </div>
        <div v-if="plotView" class="flex flex-col w-full">
          <PlotView v-model="lineData" />
        </div>
      </div>
    </YResizeable>
    </div>
    <div v-else class="hover:cursor hover:shadow-xl group flex items-center" @click="showPanel=true; transitionName='unfold';switchView('fileView')" title='Show panel'>
      <font-awesome-icon icon="fa-solid fa-arrows-left-right" style="color: #0045bd;" size="xl" class="group-hover:border-1"/></div>
    </Transition>

    <div class="ml-3 pl-3 w-auto h-full z-0" @dragover="handleDragOver" @drop="handleDrop">
      <MultiLinePlot class="line-figure"
      :data=lineData
      :width="1400"
      :height="900"
      :update="!updateInprogress"/> 
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;     /* 纵向排列 */
  align-items: start;        /* x 轴居中 */  
}
.lineDisp {
  margin: 0px;
  padding: 0px;
  font-size: small;
  font-weight: bolder;
  font-family: Monaco, 'Jetbrains Mono', monospace;
}

.fold-enter-active{
  transition: all 0.03s ease;
}
.fold-leave-active {
  transition: all 0.5s ease;
}

.fold-enter-from{
  opacity: 0;
}

.fold-leave-to {
  transform: translateX(-100px);
  opacity: 0;
}

.unfold-enter-active{
  transition: all 0.5s ease-out;
}
.unfold-leave-active {
  transition: all 0.05s ease-out;
}

.unfold-enter-from{
  transform: translateX(-100px);
}

.unfold-leave-to {
  opacity: 0;
}

</style>



