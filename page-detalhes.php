<?php get_header(); ?>

<div class="header-video-hero">
    <video autoplay loop muted playsinline>
        <source src="<?php echo get_template_directory_uri(); ?>/assets/Mat_Tec_1.mp4" type="video/mp4">
    </video>

    <div class="overlay"></div>

    <div class="content">
        <img src="<?php echo get_template_directory_uri(); ?>/assets/logoUFPR.png" class="ufpr-logo-small">
        <p class="p-campus">Campus Jandaia do Sul</p>
        <h1>Licenciatura em Matemática<br>e Tecnologias Digitais</h1>
    </div>
</div>

<section class="container">
    <h2>Diferenciais do Curso</h2>
    <p>O curso de Licenciatura em Matemática e Tecnologias Digitais da UFPR oferece uma formação única...</p>
</section>

<section class="container">
    <h2>Conheça a Grade do Curso (Eixos)</h2>

    <div class="eixos-grid">

        <div class="eixo-card eixo-matematica">
            <i class="fas fa-divide"></i>
            <h3>Eixo de Matemática Pura</h3>
            <p>Inclui: Cálculo, Álgebra Linear...</p>
        </div>

        <div class="eixo-card eixo-tecnologia">
            <i class="fas fa-microchip"></i>
            <h3>Eixo de Tecnologias Digitais</h3>
            <p>Inclui: Algoritmos, Robótica...</p>
        </div>

        <div class="eixo-card eixo-ensino">
            <i class="fas fa-chalkboard-user"></i>
            <h3>Eixo de Didática e Ensino</h3>
            <p>Inclui: Psicologia da Educação...</p>
        </div>

    </div>
</section>

<?php get_footer(); ?>