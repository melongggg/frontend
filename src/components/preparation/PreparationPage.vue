<!-- Test comment to force re-compilation -->
<template>
  <div class="main-container">
    <div class="main-div">
        <div class='white-div'>
            <img src='./prepareimg.svg' alt='서비스 준비 중' />
            <p class='big-p'>서비스 준비 중</p>
            <p class='gray-p'>현재 기능은 준비중에 있어요.</p>
            <p class='gray-p'>빠른 시일내에 준비하여 찾아올게요.</p>
            <button @click="goToChatApp">돌아가기</button>
        </div>
        <div class='sub-div'>
            <p>더 좋은 서비스를 위해 멤버도 모집 중이에요 👉🏻</p><p class='underline' @click="goToCrew"> 합류하기</p>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';


const router = useRouter();
const route = useRoute();



function goToChatApp() {
  router.push('/chat')
}

const goToCrew = () => {
  router.push('/crew');
};

</script>

<style scoped>


.main-container{
    background-color:#F0F6FF;
    width:100vw;
    height:100vh;
    position:relative;
    background-image:url('./Union.svg');
    background-repeat:no-repeat;
    background-position:right bottom;
}

.main-div{
    position:absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width:412px;
    height:385px;
    display:flex;
    flex-direction:column;
    gap:20px;
    
}

.white-div{
    background-color:white;
    width:412px;
    height:338px;
    display:flex;
    flex-direction: column;
    justify-content:center;
    align-items:center;
    border-radius: 10px;
    
}

.sub-div{
    display:flex;
justify-content:center;
gap:5px;
}

.sub-div>p{
    
    font-size:18px;
    color:#02478A;
}

.white-div>button{
     background-color: #02478A;
     font-size:20px;
     font-weight:700px;
     color:white;
     width:181px;
     height:47px;
     border-radius:10px;
     margin-top:20px;
}

.white-div>.gray-p{
    color:#9CA3AF;
}

.white-div>.big-p{
    margin:15px auto;
    font-size:25px;
    font-weight:700;
}


.underline{
    text-decoration: underline #02478A;
}


</style>
