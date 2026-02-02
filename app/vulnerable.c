// vulnerable.c - CÓDIGO C VULNERABLE

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// 1. BUFFER OVERFLOW en función
void vulnerable_buffer_overflow() {
    char buffer[10];
    printf("Introduce texto (overflow): ");
    // VULNERABLE: gets() no verifica límites
    gets(buffer);
    printf("Buffer: %s\n", buffer);
}

// 2. FORMAT STRING VULNERABILITY
void vulnerable_format_string() {
    char user_input[100];
    printf("Introduce formato: ");
    fgets(user_input, 100, stdin);
    user_input[strcspn(user_input, "\n")] = 0;
    
    // VULNERABLE: printf con string controlado por usuario
    printf(user_input);
    printf("\n");
}

// 3. INTEGER OVERFLOW
void vulnerable_integer_overflow() {
    int size;
    printf("Introduce tamaño para malloc: ");
    scanf("%d", &size);
    
    // VULNERABLE: No verifica overflow
    char *buffer = (char *)malloc(size);
    
    if(buffer) {
        printf("Introduce datos: ");
        // VULNERABLE: Posible overflow
        scanf("%s", buffer);
        printf("Datos: %s\n", buffer);
        free(buffer);
    }
}

// 4. USE AFTER FREE
void vulnerable_use_after_free() {
    char *ptr = (char *)malloc(20);
    strcpy(ptr, "Datos seguros");
    
    printf("Antes de free: %s\n", ptr);
    free(ptr); // Liberamos memoria
    
    // VULNERABLE: Uso después de liberar
    printf("Después de free: %s\n", ptr); // COMPORTAMIENTO INDEFINIDO
    
    // Más grave aún: reescribir memoria liberada
    strcpy(ptr, "Datos maliciosos");
}

// 5. ARBITRARY WRITE
void vulnerable_arbitrary_write() {
    int value;
    int *pointer;
    
    printf("Dirección a escribir (en decimal): ");
    scanf("%lu", (unsigned long*)&pointer);
    
    printf("Valor a escribir: ");
    scanf("%d", &value);
    
    // VULNERABLE: Escritura en dirección arbitraria
    *pointer = value;
    printf("Escrito %d en dirección %p\n", value, (void*)pointer);
}

// 6. COMMAND INJECTION
void vulnerable_system_call() {
    char filename[100];
    printf("Nombre del archivo a listar: ");
    fgets(filename, 100, stdin);
    filename[strcspn(filename, "\n")] = 0;
    
    char command[150];
    // VULNERABLE: Construcción insegura de comando
    sprintf(command, "ls -la %s", filename);
    
    // VULNERABLE: system() con input del usuario
    system(command);
}

// 7. STACK OVERFLOW con recursión
void vulnerable_recursion(int depth) {
    char buffer[100]; // En la pila
    printf("Profundidad: %d\n", depth);
    
    // VULNERABLE: Recursión infinita posible
    vulnerable_recursion(depth + 1);
}

// 8. DIVISIÓN POR CERO
void vulnerable_division() {
    int a, b;
    printf("Introduce dos números (a / b): ");
    scanf("%d %d", &a, &b);
    
    // VULNERABLE: No verifica divisor cero
    int result = a / b;
    printf("Resultado: %d\n", result);
}

int main() {
    printf("=== DEMO CÓDIGO VULNERABLE EN C ===\n");
    
    int opcion;
    printf("\nSelecciona vulnerabilidad a probar:\n");
    printf("1. Buffer Overflow\n");
    printf("2. Format String\n");
    printf("3. Integer Overflow\n");
    printf("4. Use After Free\n");
    printf("5. División por Cero\n");
    printf("Opción: ");
    scanf("%d", &opcion);
    getchar(); // Limpiar buffer
    
    switch(opcion) {
        case 1:
            vulnerable_buffer_overflow();
            break;
        case 2:
            vulnerable_format_string();
            break;
        case 3:
            vulnerable_integer_overflow();
            break;
        case 4:
            vulnerable_use_after_free();
            break;
        case 5:
            vulnerable_division();
            break;
        default:
            printf("Opción no válida\n");
    }
    
    return 0;
}