<template>
  <div :class="['common-footer', className]">
    <div class="footer-links">
      <router-link to="/privacy-policy" class="text-wrapper link">개인정보처리방침</router-link>
      <span class="separator">|</span>
      <router-link to="/bug-report" class="text-wrapper link">버그 제보</router-link>
    </div>
    <p class="div">Copyright ⓒ EULGPT. All Rights Reserved</p>
    <div class="text-wrapper-2">E-mail: EULJGPT@gmail.com</div>
  </div>
</template>

<script>
export default {
  name: "CommonFooter",
  props: {
    className: {
      type: String,
      default: "",
    },
  },
};
</script>

<style scoped>
.common-footer {
  /* align-items: center; */
  background-color: var(--color-footer-bg);
  display: flex;
  flex-direction: column;
  gap: 5px;
  height: 120px;
  justify-content: center;
  padding: 10px 200px;
  position: relative;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}

.common-footer .footer-links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.common-footer .text-wrapper {
  color: var(--color-text-secondary);
  font-family: 'Pretendard', sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.3;
  text-decoration: none;
}

.common-footer .text-wrapper.link {
  cursor: pointer;
  transition: color 0.2s ease;
}

.common-footer .text-wrapper.link:hover {
  color: #02478A;
}

.common-footer .separator {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}

.common-footer .div {
  align-self: stretch;
  color: var(--color-text-secondary);
  font-family: 'Pretendard', sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.3;
  position: relative;
}

.common-footer .text-wrapper-2 {
  align-self: stretch;
  color: var(--color-text-tertiary);
  font-family: 'Pretendard', sans-serif;
  font-size: 0.6rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  line-height: 1.3;
  position: relative;
}

.div, .text-wrapper-2 {
  /* text-align: center; */
}

/* 태블릿 반응형 */
@media (max-width: 1024px) {
  .common-footer {
    padding: 10px 100px;
    height: 100px;
  }
}
@media (max-width : 1024px) {
  .div {
    text-align: center;
  }

  .text-wrapper-2 {
    text-align: center;
  }
}

/* 모바일 반응형 */
@media (max-width: 768px) {
  .common-footer {
    padding: 15px 40px;
    height: 90px;
    gap: 8px;
  }
  
  .common-footer .text-wrapper {
    font-size: 0.75rem;
    text-align: center;
  }
  
  .common-footer .div {
    font-size: 0.6rem;
    text-align: center;
  }
  
  .common-footer .text-wrapper-2 {
    font-size: 0.55rem;
    text-align: center;
  }
}

/* 소형 모바일 반응형 */
@media (max-width: 480px) {
  .common-footer {
    padding: 15px 20px;
    height: 80px;
    gap: 6px;
  }
  
  .common-footer .text-wrapper {
    font-size: 0.7rem;
  }
  
  .common-footer .div {
    font-size: 0.55rem;
  }
  
  .common-footer .text-wrapper-2 {
    font-size: 0.5rem;
  }
}
</style>
