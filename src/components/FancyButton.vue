<template>
    <div class="group relative rounded-xl border border-blue-300 bg-white text-left shadow-md hover:-translate-y-0.5 hover:cursor-pointer flex hover:shadow-2xl " 
    :title="props.title" 
    @click="props.onClick">
        <slot></slot>
        <!-- 底部蓝框 -->
        <div class="absolute bottom-0 left-0 w-full h-2  rounded-b-xl z-40 bg-gray-400 group-hover:bg-blue-300 transition-background duration-400"></div>
    </div>
</template>

<script setup>

const props = defineProps({
    title: String,
    description: String,
    width: {
        type: Number,
        default: 300
    },
    height: {
        type: Number,
        default: 100
    },
    onClick: Function
});

</script>

<style scoped>

</style>
