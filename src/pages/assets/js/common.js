(function ($) {
    let scroll_pos1 = 0;

    // =============================
    // Helper: Body lock/unlock (Modal)
    // =============================
    function addFixedBodyModal() {
        scroll_pos1 = $(window).scrollTop();
        $('body')
            .addClass('overflow_modal')
            .css({ top: -scroll_pos1 + 'px' });
    }

    function removeFixedBodyModal() {
        $('body').removeClass('overflow_modal').css({ top: '' });
        $(window).scrollTop(scroll_pos1);
    }

    // =============================
    // Helper: Debounce
    // =============================
    function debounce(func, wait = 100) {
        let timeout;
        return function () {
            clearTimeout(timeout);
            timeout = setTimeout(func, wait);
        };
    }

    // =============================
    // Scroll Behavior
    // =============================
    function handleScroll() {
        const scrollTop = $(window).scrollTop();

        // Header active & ToTop visibility
        if (scrollTop > 50) {
            $(".c-totop").css("transform", "translateY(0)");
            $(".c-header").addClass("active");
        } else {
            $(".c-totop").removeAttr("style");
            $(".c-header").removeClass("active");
        }
    }

    // =============================
    // On Document Ready
    // =============================
    $(function () {
        // Smooth anchor scroll
        $('a[href^="#"]').on('click', function (e) {
            const hash = $(this).attr("href");
            if (hash === "#") return;
            const target = $(hash);
            if (target.length) {
                e.preventDefault();
                const offset = target.offset().top - ($('.c-header').outerHeight() + 30);
                $('html, body').animate({ scrollTop: offset }, 600);
            }
        });

        // Auto scroll to anchor if URL has hash
        const hash = location.hash;
        if (hash && $(hash).length) {
            const offset = $(hash).offset().top - ($('.c-header').outerHeight() + 30);
            $('html, body').animate({ scrollTop: offset }, 600);
        }

        // Menu toggle
        $(".c-toggle").on("click", function () {
            const isActive = $(this).hasClass("active");
            $(this).toggleClass("active");

            $(".c-gnavi").stop().slideToggle("fast");
            isActive ? removeFixedBodyModal() : addFixedBodyModal();
        });

        // Initial scroll state
        handleScroll();
    });

    // =============================
    // On Window Load
    // =============================
    $(window).on('load', function () {
        // Init AOS
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 1000,
                once: true,
            });
        }

        // Init ScrollHint
        if ($('.js_scrollable, .has-fixed-layout').length && typeof ScrollHint !== 'undefined') {
            new ScrollHint('.js_scrollable, .has-fixed-layout', {
                scrollHintIconAppendClass: 'scroll-hint-icon-white',
                applyToParents: true,
                i18n: {
                    scrollable: 'スクロールできます',
                },
            });
        }

        // Fade animation on scroll - add .active to .js-fadeani elements
        const fadeEls = document.querySelectorAll('.js-fadeani');
        if (fadeEls.length && 'IntersectionObserver' in window) {
            const fadeObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.2 });

            fadeEls.forEach(function (el) {
                fadeObserver.observe(el);
            });
        }

        // header
        handleScroll();
    });

    // =============================
    // On Scroll
    // =============================
    $(window).on('scroll', debounce(handleScroll, 50));

    // =============================
    // On Resize
    // =============================
    $(window).on('resize', debounce(function () {
        if ($(window).width() > 767) {
            $(".c-gnavi").removeAttr("style");
            $(".c-toggle").removeClass("active");
            if ($('body').hasClass('overflow_modal')) {
                removeFixedBodyModal();
            }
        }
        handleScroll();
    }, 150));

})(jQuery);
