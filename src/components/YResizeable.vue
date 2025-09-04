<template>
    <div class="flex justify-stretch" :style="{ width: panelWidth + 'px' }" ref="panel">
        <slot></slot>
        <div class="flex w-2 h-full bg-gray-200 hover:cursor-col-resize opacity-20 hover:opacity-80 items-center select-none" 
        @mousedown="handleMouseDown" 
        @mouseup ="draggable = false"
        @dragable="draggable" 
        @dblclick="panelWidth = 300">||</div>
    </div>
    
</template>

<script setup>
import { ref } from 'vue';

const panelWidth = ref(300);
const draggable = ref(false);
const panel = ref(null);
const props = defineProps({
    minWidth: {
        type: Number,
        default: 200
    }
});
const handleMouseMove = (event) => {
    if (draggable.value) {
        const leftX = panel.value.getBoundingClientRect().left;
        panelWidth.value = Math.max(event.clientX-leftX, props.minWidth);
    }
}

const handleMouseDown = (event) => {
    draggable.value = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
}

const handleMouseUp = () => {
    draggable.value = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
}

</script>