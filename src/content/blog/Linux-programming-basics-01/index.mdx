---
title: "Linux 文件操作"
description: "在 Linux 环境下实现一个简单的通讯录来掌握文件操作以及相关链表定义等概念"
pubDate: 2026-07-14
tags: ["Linux"]
series: "Linux C/C++ 编程基础"
seriesOrder: 1
draft: false
featured: false
---

## 通讯录数据结构定义

一般来说, 能用简单的数据结构就不要用复杂的。

但要注意底层数据结构和业务之间的分离。

选择双向链表作为底层数据结构，通过宏定义函数的方式（减小函数调用开销）实现链表的插入与删除操作：

```c
#define LIST_INSERT(node, head) do { \
    node->prev = NULL;               \
    node->next = head;               \
    if ((head) != NULL)              \
        (head)->prev = node;         \
    (head) = node;                  \
} while(0)

// head <-> node1 <-> node2
#define LIST_REMOVE(node, head) do { \
    if ((head) == (node)) (head) = node->next;             \
    if (node->prev != NULL) node->prev->next = node->next; \
    if (node->next != NULL) node->next->prev = node->prev; \
    node->prev = NULL;                                     \
    node->next = NULL;                                     \
} while(0)

struct listNode {
    void* data;
    struct listNode* prev;
    struct listNode* next;
};
```

注意这里通过 `void* data` 来指向实际的业务数据，之后定义具体的业务数据结构：

```c
struct person {
    char name[NAME_LEN];
    char phone_num[PHONE_NUM_LEN];
};

struct contacts {
    struct listNode* people;
    unsigned int count;
};
```

## 实现数据接口层

数据接口层就是对底层数据结构中数据的 CRUD 以及存盘和读盘的操作。

这里以 `person_insert()` 以及 `load_file()` 举例：

```c
int person_insert(struct listNode** plist, struct person* ps) {
    if (ps == NULL) return -1;

    struct listNode* node = (struct listNode*)malloc(sizeof(struct listNode));
    if (node == NULL) return -2;

    node->data = ps;
    LIST_INSERT(node, *plist);
    return 0;
}
```

这里参数传二级指针的原因是**插入操作**可能改变链表的首节点，因此需要传入头指针变量的地址。
