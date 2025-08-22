<!--
  File: MyComponent.vue
  Author: Your Name
  Description: 记录Plot中的变量信息 例如颜色、线条粗细等
  Created: 2025-08-05
-->

<template>
    <div class="flex flex-col w-full">
        <h2 class="border-b-2 border-black mb-4 flex justify-start font-extrabold text-red-500 w-full">Graph Signals</h2>
        <div class="signal-container relative" ref="signalContainer"> 
            <div v-for="signal in Object.keys(plotData)" class="flex border-1 items-center justify-between overflow-auto hover:bg-gray-300 rounded-md">
                <span class="pl-1 overflow-hidden" :style="{'color': plotData[signal].color}" :title="plotData[signal]['sigName']">{{ plotData[signal]["sigName"] }}</span>
                <div class="flex justify-end p-1 items-center"><color-picker v-model:pureColor="plotData[signal].color" shape="circle" @pureColorChange="(e)=>handleColorChange(e, signal)"/>
                    <span @click="(e)=>handleLineClick(e, signal)"><svg class="w-8 h-5">
                        <line x1="0" y1="10" x2="100" y2="10" stroke="black" :stroke-width="plotData[signal].stroke"/>
                        <circle v-if="plotData[signal].circle" cx="16" cy="10" r="5" fill="none" stroke="black"/>
                    </svg></span>
                    <svg class="w-4 h-4 text-gray-600 hover:text-red-500 cursor-pointer" viewBox="0 0 24 24" fill="none" @click="handleDelete(signal)">
                        <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2" />
                        <line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" stroke-width="2" />
                    </svg>
                </div>
            </div>
            <div v-if="visible" ref="lineSel" class="absolute w-30 h-auto border-0.5 bg-sky-300/5 flex flex-col items-center z-[100]"   
                :style="{ top: position.y + 'px', left: position.x + 'px' }" @mouseleave="handlerMouseleave">   <!-- 弹出式线条选择框 -->
                <div v-for="width in lineWidth" class="line-display" @click="handleLineChanged(width, false)">      <!-- without circle -->
                    <svg class="w-full h-5 px-2">
                        <line x1="0" y1="10" x2="100" y2="10" stroke="black" :stroke-width="width"/>
                    </svg>
                </div>
                <div v-for="width in lineWidth" class="line-display" @click="handleLineChanged(width, true)">    <!-- with circle -->
                    <svg class="w-full h-5 px-2">
                        <line x1="0" y1="10" x2="100" y2="10" stroke="black" :stroke-width="width"/>
                        <circle cx="50" cy="10" r="5" fill="none" stroke="black"/>
                    </svg>
                </div>
            </div>  
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
const plotData = defineModel();
const visible = ref(false);
const position = ref({ x: 0, y: 0 });
const signalContainer = ref(null);
const lineSel = ref(null);
let currentSelectedSignal = "" ;
const lineWidth = ref([1, 1.5, 2, 2.5, 3.5]);
const emit = defineEmits(["update-plot-style", "delete-signal"]);

const handleDelete = (key) => {
    const file = plotData.value[key].file;
    delete plotData.value[key];
    emit("delete-signal", key, file);
}

const handleColorChange = (color, key) => {
    console.log("color", color, key);
    emit("update-plot-style", key);
}

const handleLineClick = (e, signal) => {
    if (visible.value) {
        visible.value = false;
        window.removeEventListener('click', handleClickElsewhere); // 移除事件监听器
        return;
    }
    const rect = signalContainer.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    position.value = { x: x-80, y: y+10 };
    visible.value = true;
    currentSelectedSignal = signal;   // 记录当前选中的信号
    setTimeout(() => {
        window.addEventListener('click', handleClickElsewhere);    // 不能立即添加事件监听 可能会冲突
    }, 200);
}

const handleClickElsewhere = (e) => {
    if (lineSel.value && visible && !lineSel.value.contains(e.target)) {
        visible.value = false;
        window.removeEventListener('click', handleClickElsewhere); // 移除事件监听器
    }
}

const handleLineChanged = (width, circle) => {
    if (currentSelectedSignal && currentSelectedSignal in plotData.value) {
        plotData.value[currentSelectedSignal].stroke = width;
        plotData.value[currentSelectedSignal].circle = circle;
        emit('update-plot-style', currentSelectedSignal);
    }
    visible.value = false; // 关闭选择框
    window.removeEventListener('click', handleClickElsewhere); // 移除事件监听器
}

const handlerMouseleave = (e) => {
    if (visible.value) {
        visible.value = false; // 鼠标离开时隐藏选择框
        window.removeEventListener('click', handleClickElsewhere); // 移除事件监听器
    }
}

</script>

<style scoped>
.signal-container {
    width: 100%;
}

.line-display:hover {
    border: 1px solid red;
    background-color: #dad0d0;
}
</style>