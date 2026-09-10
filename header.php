<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <title><?php wp_title(); ?></title>

    <?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>

<nav class="simple-nav">
    <div class="container">
        <a href="<?php echo home_url(); ?>">
            <i class="fas fa-home"></i> Início
        </a> / <span><?php the_title(); ?></span>
    </div>
</nav>